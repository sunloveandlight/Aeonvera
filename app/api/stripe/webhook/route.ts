import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function normalizeSubscriptionStatus(status: Stripe.Subscription.Status) {
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due") return "past_due";
  return "canceled";
}

/**
 * Core = core
 * Elite = elite (monthly)
 * Sovereign = elite (annual)
 */
function getPlanData(priceId: string) {
  if (priceId === process.env.STRIPE_CORE_PRICE_ID) {
    return { plan: "core", billing_type: "monthly" };
  }

  if (priceId === process.env.STRIPE_ELITE_PRICE_ID) {
    return { plan: "elite", billing_type: "monthly" };
  }

  if (priceId === process.env.STRIPE_SOVEREIGN_PRICE_ID) {
    return { plan: "elite", billing_type: "annual" };
  }

  return null;
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new NextResponse("Missing signature", { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    return new NextResponse(`Webhook Error: ${err.message}`, {
      status: 400,
    });
  }

  const supabase = getSupabaseAdmin();

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
      const priceId = lineItems.data[0]?.price?.id;

      const planData = getPlanData(priceId!);

      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (!profile?.user_id) return;

      await supabase.from("profiles").update({
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        plan: planData?.plan ?? null,
        billing_type: planData?.billing_type ?? null,
        subscription_status: "active",
        updated_at: new Date().toISOString(),
      }).eq("user_id", profile.user_id);
    }

    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;

      const priceId = sub.items.data[0]?.price.id;
      const planData = getPlanData(priceId!);

      await supabase
        .from("profiles")
        .update({
          plan: planData?.plan ?? null,
          billing_type: planData?.billing_type ?? null,
          subscription_status: normalizeSubscriptionStatus(sub.status),
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", sub.id);
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;

      await supabase
        .from("profiles")
        .update({
          plan: null,
          billing_type: null,
          subscription_status: "canceled",
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", sub.id);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return new NextResponse(err.message, { status: 500 });
  }
}