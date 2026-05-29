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

    const eventId = event.id;

    // 🔥 FIX 1: SAFE DEDUP CHECK (no .single crash)
    const { data: existingEvent } = await supabase
      .from("stripe_events")
      .select("id")
      .eq("id", eventId)
      .maybeSingle();

    if (existingEvent) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    // 🔥 FIX 2: INSERT FIRST, BUT IGNORE DUP FAIL SAFELY
    const { error: insertError } = await supabase
      .from("stripe_events")
      .insert({
        id: eventId,
        type: event.type,
        created_at: new Date().toISOString(),
      });

    if (insertError && insertError.code !== "23505") {
      console.error("Event insert error:", insertError);
      return NextResponse.json({ error: "Event logging failed" }, { status: 500 });
    }

    // 🔁 STEP 2: HANDLE EVENTS
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const userId = session.metadata?.user_id;
        const plan = session.metadata?.plan;

        // 🔥 FIX 3: HARD GUARD (no silent failures)
        if (!userId || !plan) {
          console.error("Missing metadata:", session.metadata);
          break;
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
        const subscription = event.data.object as Stripe.Subscription;

        const customerId = subscription.customer as string;

        await supabase
          .from("profiles")
          .update({
            subscription_status: subscription.status,
            plan: subscription.status === "active" ? "pro" : "free",
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
            plan: "free",
          })
          .eq("stripe_customer_id", customerId);

        break;
      }

      default:
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