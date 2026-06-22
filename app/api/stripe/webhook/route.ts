import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  getUserIdForStripeCustomer,
  syncUserSubscriptionState,
} from "@/lib/billing/subscriptionSync";
import type { Plan } from "@/lib/auth/permissions";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  return new Stripe(key, {
    apiVersion: "2026-05-27.dahlia",
  });
}

function getWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET");
  }

  return secret;
}

function getPlanFromPriceId(priceId?: string | null): Plan | null {
  const priceToPlan: Record<string, Plan> = {};

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

function getPlanFromSubscription(sub: Stripe.Subscription): Plan | null {
  const priceId = sub.items.data[0]?.price.id;
  return getPlanFromPriceId(priceId) ?? normalizePlan(sub.metadata?.plan);
}

export async function POST(req: NextRequest) {
  let insertedStripeEventId: string | null = null;

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
      getWebhookSecret()
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
      if (insertError.code === "23505") {
        return NextResponse.json({ received: true });
      }
      return NextResponse.json(
        { error: "Could not record Stripe event" },
        { status: 500 }
      );
    }
    insertedStripeEventId = event.id;

    // ----------------------------
    // EVENT HANDLING
    // ----------------------------
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;

        const userId = session.metadata?.user_id;
        const conciergeRequestId = session.metadata?.concierge_request_id;
        const checkoutKind = session.metadata?.kind;
        const metadataPlan = normalizePlan(session.metadata?.plan);

        if (checkoutKind === "sovereign_concierge" && conciergeRequestId && userId) {
          const { error: conciergeError } = await supabase
            .from("concierge_onboarding_requests")
            .update({
              paid_at: new Date().toISOString(),
              payment_status: "paid",
              status: "reviewing",
              stripe_checkout_session_id: session.id,
              stripe_payment_intent_id:
                typeof session.payment_intent === "string"
                  ? session.payment_intent
                  : session.payment_intent?.id || null,
            })
            .eq("id", conciergeRequestId)
            .eq("user_id", userId);

          if (conciergeError) throw conciergeError;
          break;
        }

        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;

        if (!userId) {
          break;
        }

        const subscription = subscriptionId
          ? await stripe.subscriptions.retrieve(subscriptionId)
          : null;
        const priceId = subscription?.items.data[0]?.price.id || null;
        const plan = subscription ? getPlanFromSubscription(subscription) : metadataPlan;

        if (!plan) break;

        await syncUserSubscriptionState({
          currentPeriodEnd: subscription ? getCurrentPeriodEnd(subscription) : null,
          plan,
          status: subscription?.status || "active",
          stripeCustomerId: getCustomerId(session.customer),
          stripePriceId: priceId,
          stripeSubscriptionId: subscriptionId || null,
          supabase,
          userId,
        });

        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const plan = getPlanFromSubscription(sub);
        const customerId = getCustomerId(sub.customer);

        if (!plan || !customerId) break;

        const userId = await getUserIdForStripeCustomer({
          stripeCustomerId: customerId,
          supabase,
        });

        if (!userId) break;

        await syncUserSubscriptionState({
          currentPeriodEnd: getCurrentPeriodEnd(sub),
          plan,
          status: sub.status,
          stripeCustomerId: customerId,
          stripePriceId: sub.items.data[0]?.price.id || null,
          stripeSubscriptionId: sub.id,
          supabase,
          userId,
        });

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

        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id,plan,stripe_subscription_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle<{
            plan: string | null;
            stripe_subscription_id: string | null;
            user_id: string | null;
          }>();

        const plan = normalizePlan(profile?.plan) || "core";
        const userId = profile?.user_id;

        if (!userId) break;

        await syncUserSubscriptionState({
          plan,
          status: "past_due",
          stripeCustomerId: customerId,
          stripeSubscriptionId: profile?.stripe_subscription_id || undefined,
          supabase,
          userId,
        });

        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = getCustomerId(sub.customer);

        if (!customerId) break;

        const userId = await getUserIdForStripeCustomer({
          stripeCustomerId: customerId,
          supabase,
        });

        if (!userId) break;

        await syncUserSubscriptionState({
          currentPeriodEnd: getCurrentPeriodEnd(sub),
          plan: "core",
          status: "canceled",
          stripeCustomerId: customerId,
          stripePriceId: sub.items.data[0]?.price.id || null,
          stripeSubscriptionId: sub.id,
          supabase,
          userId,
        });

        break;
      }

      default:
        console.info(`Unhandled Stripe event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);

    if (insertedStripeEventId) {
      const { error } = await getSupabaseAdmin()
        .from("stripe_events")
        .delete()
        .eq("id", insertedStripeEventId);

      if (error) {
        console.error("Stripe event rollback failed:", error);
      }
    }

    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

function normalizePlan(plan: string | null | undefined): Plan | null {
  return plan === "core" || plan === "elite" || plan === "sovereign"
    ? plan
    : null;
}

function getCurrentPeriodEnd(subscription: Stripe.Subscription) {
  const periodEnd = (subscription as unknown as { current_period_end?: number })
    .current_period_end;

  return periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
}

function getCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
) {
  return typeof customer === "string" ? customer : customer?.id || null;
}
