import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PLAN_HEALTH_PROFILE_LIMITS,
  type Plan,
  type SubscriptionStatus,
} from "@/lib/auth/permissions";

const VALID_SUBSCRIPTION_STATUSES = new Set<SubscriptionStatus>([
  "active",
  "trialing",
  "past_due",
  "canceled",
  "inactive",
]);

export type SubscriptionSyncInput = {
  currentPeriodEnd?: string | null;
  plan: Plan;
  status: string | null | undefined;
  stripeCustomerId?: string | null;
  stripePriceId?: string | null;
  stripeSubscriptionId?: string | null;
  userId: string;
};

export function normalizeSubscriptionStatus(
  status: string | null | undefined
): SubscriptionStatus {
  if (status && VALID_SUBSCRIPTION_STATUSES.has(status as SubscriptionStatus)) {
    return status as SubscriptionStatus;
  }

  return "inactive";
}

export function maxHealthProfilesForPlan(plan: Plan) {
  return PLAN_HEALTH_PROFILE_LIMITS[plan].maxProfiles;
}

/**
 * The workspace limit follows the subscription state Stripe reports as current.
 * If Stripe schedules a downgrade for period end, it should keep reporting the
 * current paid plan until the period flips; once Stripe reports the lower plan,
 * excess profiles become read-only instead of being deleted.
 */
export async function syncUserSubscriptionState({
  currentPeriodEnd,
  plan,
  status,
  stripeCustomerId,
  stripePriceId,
  stripeSubscriptionId,
  supabase,
  userId,
}: SubscriptionSyncInput & { supabase: SupabaseClient }) {
  const subscriptionStatus = normalizeSubscriptionStatus(status);
  const profileUpdate: Record<string, string | null> = {
    plan,
    subscription_status: subscriptionStatus,
  };

  if (stripeCustomerId !== undefined) {
    profileUpdate.stripe_customer_id = stripeCustomerId;
  }

  if (stripeSubscriptionId !== undefined) {
    profileUpdate.stripe_subscription_id = stripeSubscriptionId;
  }

  await supabase.from("profiles").update(profileUpdate).eq("user_id", userId);

  const workspaceUpdate: Record<string, string | number | null> = {
    max_health_profiles: maxHealthProfilesForPlan(plan),
    plan,
    subscription_status: subscriptionStatus,
    updated_at: new Date().toISOString(),
  };

  if (currentPeriodEnd !== undefined) {
    workspaceUpdate.current_period_end = currentPeriodEnd;
  }

  if (stripeCustomerId !== undefined) {
    workspaceUpdate.stripe_customer_id = stripeCustomerId;
  }

  if (stripePriceId !== undefined) {
    workspaceUpdate.stripe_price_id = stripePriceId;
  }

  if (stripeSubscriptionId !== undefined) {
    workspaceUpdate.stripe_subscription_id = stripeSubscriptionId;
  }

  await supabase
    .from("workspaces")
    .update(workspaceUpdate)
    .eq("owner_user_id", userId);
}

export async function getUserIdForStripeCustomer({
  stripeCustomerId,
  supabase,
}: {
  stripeCustomerId: string;
  supabase: SupabaseClient;
}) {
  const { data } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle<{ user_id: string | null }>();

  return data?.user_id || null;
}
