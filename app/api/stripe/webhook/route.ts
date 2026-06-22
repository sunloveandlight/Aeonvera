import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  getUserIdForStripeCustomer,
  syncUserSubscriptionState,
} from "@/lib/billing/subscriptionSync";
import { sendCoachEmail } from "@/lib/notifications/email";
import type { Plan } from "@/lib/auth/permissions";

const CONCIERGE_AMOUNT_CENTS = 500_000;
const CONCIERGE_CURRENCY = "usd";

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
          await assertPaidConciergeCheckout({ session, stripe });

          const { data: existingRequest, error: existingRequestError } = await supabase
            .from("concierge_onboarding_requests")
            .select("id,contact_email,fulfillment_stage,paid_at,payment_status,status,stripe_checkout_session_id")
            .eq("id", conciergeRequestId)
            .eq("user_id", userId)
            .single<{
              contact_email: string | null;
              fulfillment_stage: string | null;
              id: string;
              paid_at: string | null;
              payment_status: string | null;
              status: string | null;
              stripe_checkout_session_id: string | null;
            }>();

          if (existingRequestError) throw existingRequestError;

          if (
            existingRequest.stripe_checkout_session_id &&
            existingRequest.stripe_checkout_session_id !== session.id
          ) {
            throw new Error("Concierge checkout session does not match request.");
          }

          if (existingRequest.payment_status === "paid") {
            break;
          }

          const nextFulfillmentStage =
            existingRequest.fulfillment_stage === "intake_pending" ||
            !existingRequest.fulfillment_stage
              ? "kickoff_scheduled"
              : existingRequest.fulfillment_stage;
          const nextStatus =
            existingRequest.status === "requested" || !existingRequest.status
              ? "reviewing"
              : existingRequest.status;

          const { data: conciergeRequest, error: conciergeError } = await supabase
            .from("concierge_onboarding_requests")
            .update({
              fulfillment_stage: nextFulfillmentStage,
              paid_at: new Date().toISOString(),
              payment_status: "paid",
              status: nextStatus,
              stripe_checkout_session_id: session.id,
              stripe_payment_intent_id:
                typeof session.payment_intent === "string"
                  ? session.payment_intent
                  : session.payment_intent?.id || null,
            })
            .eq("id", conciergeRequestId)
            .eq("user_id", userId)
            .select("id,contact_email,fulfillment_stage,paid_at")
            .single<{
              contact_email: string | null;
              fulfillment_stage: string | null;
              id: string;
              paid_at: string | null;
            }>();

          if (conciergeError) throw conciergeError;

          await sendConciergePaidEmails({
            contactEmail: conciergeRequest?.contact_email || session.customer_details?.email || null,
            paidAt: conciergeRequest?.paid_at || null,
            requestId: conciergeRequestId,
            sessionId: session.id,
            userId,
          });
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

async function sendConciergePaidEmails({
  contactEmail,
  paidAt,
  requestId,
  sessionId,
  userId,
}: {
  contactEmail: string | null;
  paidAt: string | null;
  requestId: string;
  sessionId: string;
  userId: string;
}) {
  const paidLine = paidAt ? `Paid at: ${paidAt}` : "Paid at: recorded";
  const opsText = [
    "Sovereign Concierge Onboarding was paid.",
    `Request: ${requestId}`,
    `User: ${userId}`,
    `Stripe session: ${sessionId}`,
    paidLine,
    "Fulfillment stage: kickoff_scheduled",
  ].join("\n");

  const opsResult = await sendCoachEmail({
    html: `<pre style="font-family:ui-monospace,Menlo,monospace;white-space:pre-wrap">${escapeHtml(opsText)}</pre>`,
    subject: "Sovereign concierge payment received",
    text: opsText,
    to: process.env.OPS_ALERT_EMAIL || "info@aeonvera.com",
  });

  if (opsResult.status !== "sent") {
    console.warn("Concierge paid ops email skipped:", opsResult.error);
  }

  if (!contactEmail) return;

  const customerText = [
    "Your Sovereign Concierge Onboarding payment has been received.",
    "",
    "What happens next:",
    "1. We review your workspace and current data sources.",
    "2. We schedule the concierge kickoff.",
    "3. We prepare your lab, wearable, clinician export, and first 30-day protocol workflow.",
    "",
    "You can return to Aeonvera to see the concierge status from your plan page.",
  ].join("\n");

  const customerResult = await sendCoachEmail({
    html: `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#141414">
        <h1 style="font-size:22px;margin:0 0 16px">Sovereign Concierge payment received</h1>
        <p>Your Sovereign Concierge Onboarding payment has been received.</p>
        <p><strong>What happens next:</strong></p>
        <ol>
          <li>We review your workspace and current data sources.</li>
          <li>We schedule the concierge kickoff.</li>
          <li>We prepare your lab, wearable, clinician export, and first 30-day protocol workflow.</li>
        </ol>
        <p>You can return to Aeonvera to see the concierge status from your plan page.</p>
      </div>
    `,
    subject: "Your Sovereign Concierge onboarding is underway",
    text: customerText,
    to: contactEmail,
  });

  if (customerResult.status !== "sent") {
    console.warn("Concierge paid customer email skipped:", customerResult.error);
  }
}

async function assertPaidConciergeCheckout({
  session,
  stripe,
}: {
  session: Stripe.Checkout.Session;
  stripe: Stripe;
}) {
  const priceId = process.env.STRIPE_SOVEREIGN_CONCIERGE_PRICE_ID;

  if (!priceId) {
    throw new Error("Missing STRIPE_SOVEREIGN_CONCIERGE_PRICE_ID");
  }

  if (session.mode !== "payment") {
    throw new Error("Concierge checkout session was not a one-time payment.");
  }

  if (session.payment_status !== "paid") {
    throw new Error("Concierge checkout session is not paid.");
  }

  if (session.currency !== CONCIERGE_CURRENCY) {
    throw new Error("Concierge checkout currency mismatch.");
  }

  if (session.amount_total !== CONCIERGE_AMOUNT_CENTS) {
    throw new Error("Concierge checkout amount mismatch.");
  }

  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
    limit: 10,
  });
  const hasExpectedPrice = lineItems.data.some((item) => item.price?.id === priceId);

  if (!hasExpectedPrice) {
    throw new Error("Concierge checkout price mismatch.");
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
