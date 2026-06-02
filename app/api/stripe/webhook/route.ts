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

    /**
     * ✅ SAFE IDEMPOTENCY CHECK
     * (NO .single() → prevents webhook crashes)
     */
    const { data: existing, error: fetchError } = await supabase
      .from("stripe_events")
      .select("id")
      .eq("id", event.id)
      .maybeSingle();

    if (fetchError) {
      console.error("Stripe event lookup error:", fetchError);
      // do NOT fail webhook — just continue safely
    }

    // If already processed → exit safely
    if (existing) {
      return NextResponse.json({ received: true });
    }

    // Mark event as processed
    const { error: insertError } = await supabase
      .from("stripe_events")
      .insert({ id: event.id });

    if (insertError) {
      console.error("Stripe event insert error:", insertError);
      // still continue — avoids double-processing risk later
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const userId = session.metadata?.user_id;
        const plan = session.metadata?.plan;

        if (!userId) break;

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