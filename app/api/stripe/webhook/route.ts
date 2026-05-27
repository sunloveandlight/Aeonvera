import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function hasEventBeenProcessed(eventId: string) {
  const { data } = await supabase
    .from("stripe_events")
    .select("id")
    .eq("id", eventId)
    .maybeSingle();

  return !!data;
}

async function markEventProcessed(eventId: string) {
  await supabase.from("stripe_events").insert({
    id: eventId,
  });
}

function normalizeSubscriptionStatus(status: Stripe.Subscription.Status) {
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due") return "past_due";
  if (status === "canceled" || status === "unpaid") return "canceled";
  return "inactive";
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
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const alreadyProcessed = await hasEventBeenProcessed(event.id);
  if (alreadyProcessed) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    // -------------------------
    // CHECKOUT COMPLETED
    // -------------------------
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const stripeCustomerId = session.customer as string;
      const stripeSubscriptionId = session.subscription as string;

      if (!stripeCustomerId) {
        return new NextResponse("Missing stripeCustomerId", { status: 400 });
      }

      // 🔍 Find user via Stripe customer ID (NEW SAFE METHOD)
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("stripe_customer_id", stripeCustomerId)
        .maybeSingle();

      if (!profile?.user_id) {
        return new NextResponse("No matching user for Stripe customer", {
          status: 400,
        });
      }

      await supabase.from("profiles").upsert({
        user_id: profile.user_id,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        plan: "pro",
        subscription_status: "active",
        updated_at: new Date().toISOString(),
      });
    }

    // -------------------------
    // SUBSCRIPTION UPDATED
    // -------------------------
    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;

      const status = normalizeSubscriptionStatus(sub.status);

      await supabase
        .from("profiles")
        .update({
          subscription_status: status,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", sub.id);
    }

    // -------------------------
    // SUBSCRIPTION DELETED
    // -------------------------
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;

      await supabase
        .from("profiles")
        .update({
          subscription_status: "canceled",
          plan: "free",
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", sub.id);
    }

    await markEventProcessed(event.id);

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return new NextResponse(`Webhook handler failed: ${err.message}`, {
      status: 500,
    });
  }
}