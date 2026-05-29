import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe signature" },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 🔐 STEP 1: DEDUPLICATION CHECK
    const eventId = event.id;

    const { data: existingEvent } = await supabase
      .from("stripe_events")
      .select("id")
      .eq("id", eventId)
      .single();

    if (existingEvent) {
      // already processed → prevent duplicate execution
      return NextResponse.json({ received: true, duplicate: true });
    }

    // mark event as processed FIRST (important for safety)
    await supabase.from("stripe_events").insert({
      id: eventId,
      type: event.type,
      created_at: new Date().toISOString(),
    });

    // 🔁 STEP 2: HANDLE EVENTS

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const userId = session.metadata?.user_id;
        const plan = session.metadata?.plan;

        if (!userId || !plan) break;

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
        const subscription = event.data.object as Stripe.Subscription;

        const customerId = subscription.customer as string;

        const status = subscription.status;

        await supabase
          .from("profiles")
          .update({
            subscription_status: status,
          })
          .eq("stripe_customer_id", customerId);

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        const customerId = subscription.customer as string;

        await supabase
          .from("profiles")
          .update({
            subscription_status: "canceled",
            plan: null,
          })
          .eq("stripe_customer_id", customerId);

        break;
      }

      default:
        // ignore other events safely
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);

    return NextResponse.json(
      { error: "Webhook failed" },
      { status: 500 }
    );
  }
}