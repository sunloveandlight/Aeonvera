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

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature")!;

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

  // ==============================
  // 1. Checkout completed
  // ==============================
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const stripeCustomerId = session.customer as string;
    const stripeSubscriptionId = session.subscription as string;

    // STEP A: find user by stripe_customer_id
    let { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("stripe_customer_id", stripeCustomerId)
      .single();

    // STEP B: if no user exists, create one (BUY-FIRST FLOW)
    if (!profile) {
      // create auth user via admin API
      const { data: user, error } = await supabase.auth.admin.createUser({
        email: session.customer_details?.email!,
        email_confirm: true,
      });

      if (error || !user.user) {
        return new NextResponse("User creation failed", { status: 500 });
      }

      // create profile
      const { data: newProfile } = await supabase
        .from("profiles")
        .insert({
          user_id: user.user.id,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          plan: "pro",
          subscription_status: "active",
        })
        .select()
        .single();

      profile = newProfile;
    } else {
      // STEP C: update existing user (LOGIN-FIRST FLOW)
      await supabase
        .from("profiles")
        .update({
          stripe_subscription_id: stripeSubscriptionId,
          subscription_status: "active",
          plan: "pro",
        })
        .eq("user_id", profile.user_id);
    }
  }

  // ==============================
  // 2. Subscription updated
  // ==============================
  if (event.type === "customer.subscription.updated") {
    const sub = event.data.object as Stripe.Subscription;

    await supabase
      .from("profiles")
      .update({
        subscription_status: sub.status,
      })
      .eq("stripe_subscription_id", sub.id);
  }

  // ==============================
  // 3. Subscription deleted
  // ==============================
  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;

    await supabase
      .from("profiles")
      .update({
        subscription_status: "canceled",
        plan: "free",
      })
      .eq("stripe_subscription_id", sub.id);
  }

  return NextResponse.json({ received: true });
}