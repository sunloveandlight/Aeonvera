import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  normalizeSubscriptionStatus,
  syncUserSubscriptionState,
} from "@/lib/billing/subscriptionSync";
import type { Plan } from "@/lib/auth/permissions";
import { rateLimitRequest } from "@/lib/security/rateLimit";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
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

export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimitRequest(req, "stripe-sync-subscription", 12, 60_000);
    if (limited) return limited;

    const supabaseUser = createServerClient(
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

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("stripe_customer_id,stripe_subscription_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || !profile?.stripe_customer_id) {
      return NextResponse.json(
        { error: "Stripe customer not found." },
        { status: 404 }
      );
    }

    const stripe = getStripe();
    const subscriptions = await stripe.subscriptions.list({
      customer: profile.stripe_customer_id,
      status: "all",
      limit: 10,
    });

    const subscription =
      subscriptions.data.find((item) =>
        ["active", "trialing", "past_due"].includes(item.status)
      ) || null;

    if (!subscription) {
      return NextResponse.json(
        { error: "No active Stripe subscription found." },
        { status: 404 }
      );
    }

    const priceId = subscription.items.data[0]?.price.id;
    const plan = getPlanFromPriceId(priceId);

    if (!plan) {
      return NextResponse.json(
        { error: "Could not match Stripe price to an Aeonvera plan." },
        { status: 409 }
      );
    }

    await syncUserSubscriptionState({
      currentPeriodEnd: getCurrentPeriodEnd(subscription),
      plan,
      status: subscription.status,
      stripeCustomerId: profile.stripe_customer_id,
      stripePriceId: priceId,
      stripeSubscriptionId: subscription.id,
      supabase: admin,
      userId: user.id,
    });

    return NextResponse.json({
      plan,
      subscriptionStatus: normalizeSubscriptionStatus(subscription.status),
      subscriptionId: subscription.id,
    });
  } catch (error) {
    console.error("Stripe subscription sync error:", error);
    return NextResponse.json(
      { error: "Could not sync Stripe subscription." },
      { status: 500 }
    );
  }
}

function getCurrentPeriodEnd(subscription: Stripe.Subscription) {
  const periodEnd = (subscription as unknown as { current_period_end?: number })
    .current_period_end;

  return periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
}
