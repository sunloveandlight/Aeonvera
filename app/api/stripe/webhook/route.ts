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
        let plan = session.metadata?.plan as AllowedPlan | undefined;

        if (!userId) {
          break;
        }

        // Temporary compatibility layer
        if (plan === "sovereign") {
          plan = "elite";
        }

        await supabase
          .from("profiles")
          .update({
            plan,
            subscription_status: "active",
          })
          .eq("user_id", userId);

        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;

        await supabase
          .from("profiles")
          .update({
            subscription_status: sub.status,
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