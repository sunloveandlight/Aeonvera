import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerClient } from "@supabase/ssr";
import { rateLimitRequest } from "@/lib/security/rateLimit";

type Plan = "core" | "elite" | "sovereign";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
}

function getPriceIds() {
  return {
    core: process.env.STRIPE_CORE_PRICE_ID,
    elite: process.env.STRIPE_ELITE_PRICE_ID,
    sovereign: process.env.STRIPE_SOVEREIGN_PRICE_ID,
  } satisfies Record<Plan, string | undefined>;
}

export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimitRequest(req, "stripe-customer-portal", 20, 60_000);
    if (limited) return limited;

    const stripe = getStripe();
    const body = await req.json().catch(() => ({}));
    const targetPlan = sanitizePlan(body?.plan);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll() {},
        },
      }
    );

    /**
     * FIXED: use getUser() instead of getSession()
     */
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("plan,subscription_status,stripe_customer_id,stripe_subscription_id")
      .eq("user_id", user.id)
      .single();

    if (error || !profile?.stripe_customer_id) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    const currentPlan = sanitizePlan(profile.plan);
    let subscriptionId =
      typeof profile.stripe_subscription_id === "string"
        ? profile.stripe_subscription_id
        : null;
    const priceIds = getPriceIds();
    const targetPriceId = targetPlan ? priceIds[targetPlan] : null;
    const isPlanChange = Boolean(targetPlan && currentPlan && targetPlan !== currentPlan);

    if (isPlanChange && !targetPriceId) {
      return NextResponse.json(
        { error: "Missing Stripe price for the selected plan change." },
        { status: 500 }
      );
    }

    let flowData: Stripe.BillingPortal.SessionCreateParams.FlowData | undefined;
    let fallbackFlowData: Stripe.BillingPortal.SessionCreateParams.FlowData | undefined;

    if (isPlanChange && !subscriptionId) {
      const subscriptions = await stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        status: "all",
        limit: 10,
      });
      subscriptionId =
        subscriptions.data.find((subscription) =>
          ["active", "trialing", "past_due"].includes(subscription.status)
        )?.id || null;
    }

    if (isPlanChange && subscriptionId && targetPriceId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const subscriptionItem = subscription.items.data[0];

      if (subscriptionItem?.id) {
        fallbackFlowData = {
          type: "subscription_update",
          subscription_update: {
            subscription: subscription.id,
          },
          after_completion: {
            type: "redirect",
            redirect: {
              return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/success?plan=${targetPlan}`,
            },
          },
        };
        flowData = {
          type: "subscription_update_confirm",
          subscription_update_confirm: {
            subscription: subscription.id,
            items: [
              {
                id: subscriptionItem.id,
                price: targetPriceId,
                quantity: subscriptionItem.quantity || 1,
              },
            ],
          },
          after_completion: {
            type: "redirect",
            redirect: {
              return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/success?plan=${targetPlan}`,
            },
          },
        };
      }
    }

    const portalSession = await createPortalSessionWithFallback({
      customerId: profile.stripe_customer_id,
      fallbackFlowData,
      flowData,
      stripe,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error("Customer Portal Error:", error);
    return NextResponse.json(
      { error: "Could not open Stripe billing management." },
      { status: 500 }
    );
  }
}

function sanitizePlan(value: unknown): Plan | null {
  return value === "core" || value === "elite" || value === "sovereign"
    ? value
    : null;
}

async function createPortalSessionWithFallback({
  customerId,
  fallbackFlowData,
  flowData,
  stripe,
}: {
  customerId: string;
  fallbackFlowData?: Stripe.BillingPortal.SessionCreateParams.FlowData;
  flowData?: Stripe.BillingPortal.SessionCreateParams.FlowData;
  stripe: Stripe;
}) {
  const baseParams = {
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/pricing`,
  };

  try {
    return await stripe.billingPortal.sessions.create({
      ...baseParams,
      ...(flowData ? { flow_data: flowData } : {}),
    });
  } catch (error) {
    if (!fallbackFlowData || !flowData) {
      throw error;
    }

    console.warn("Stripe targeted plan change failed, opening subscription update flow.", error);

    return stripe.billingPortal.sessions.create({
      ...baseParams,
      flow_data: fallbackFlowData,
    });
  }
}
