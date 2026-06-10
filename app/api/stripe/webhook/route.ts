import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  return new Stripe(key, {
    apiVersion: "2026-05-27.dahlia",
  });
}

type AllowedPlan = "core" | "elite" | "sovereign";

function getPlanFromPriceId(priceId?: string | null): AllowedPlan | null {
  const priceToPlan: Record<string, AllowedPlan> = {};

  if (process.env.STRIPE_CORE_PRICE_ID) {
    priceToPlan[process.env.STRIPE_CORE_PRICE_ID] = "core";
  }

  if (process.env.STRIPE_ELITE_PRICE_ID) {
    priceToPlan[process.env.STRIPE_ELITE_PRICE_ID] = "elite";
  }

  if (process.env.STRIPE_SOVEREIGN_PRICE_ID) {
    priceToPlan[process.env.STRIPE_SOVEREIGN_PRICE_ID] = "sovereign";
  }

  return priceId ? priceToPlan[priceId] ?? null : null;
}

function getPlanFromSubscription(sub: Stripe.Subscription): AllowedPlan | null {
  const priceId = sub.items.data[0]?.price.id;
  return getPlanFromPriceId(priceId) ?? (sub.metadata?.plan as AllowedPlan | undefined) ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe();
    const supabase = getSupabaseAdmin();

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 400 }
      );
    }

    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    // ----------------------------
    // IDEMPOTENCY CHECK
    // ----------------------------
    const { data: existing, error: fetchError } = await supabase
      .from("stripe_events")
      .select("id")
      .eq("id", event.id)
      .maybeSingle();

    if (fetchError) {
      console.error("Stripe event lookup error:", fetchError);
    }

    if (existing) {
      return NextResponse.json({ received: true });
    }

    const { error: insertError } = await supabase
      .from("stripe_events")
      .insert({ id: event.id });

    if (insertError) {
      console.error("Stripe event insert error:", insertError);
    }

    // ----------------------------
    // EVENT HANDLING
    // ----------------------------
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;

        const userId = session.metadata?.user_id;
        const plan = session.metadata?.plan as AllowedPlan | undefined;

        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;

        if (!userId) {
          break;
        }

        await supabase
          .from("profiles")
          .update({
            plan,
            subscription_status: "active",
            stripe_subscription_id: subscriptionId,
          })
          .eq("user_id", userId);

        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const plan = getPlanFromSubscription(sub);

        await supabase
          .from("profiles")
          .update({
            ...(plan ? { plan } : {}),
            subscription_status: sub.status,
            stripe_subscription_id: sub.id,
          })
          .eq("stripe_customer_id", sub.customer as string);

        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;

        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;

        if (!customerId) {
          break;
        }

        await supabase
          .from("profiles")
          .update({
            subscription_status: "past_due",
          })
          .eq("stripe_customer_id", customerId);

        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;

        await supabase
          .from("profiles")
          .update({
            plan: "core",
            subscription_status: "canceled",
          })
          .eq("stripe_customer_id", sub.customer as string);

        break;
      }

      default:
        console.log(`Unhandled Stripe event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);

    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
