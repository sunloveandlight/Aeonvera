export type Plan = "core" | "elite";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "inactive";

export type Feature =
  | "dashboard_access"
  | "core_features"
  | "elite_features";

const PLAN_PERMISSIONS: Record<Plan, Feature[]> = {
  core: ["dashboard_access", "core_features"],
  elite: ["dashboard_access", "core_features", "elite_features"],
};

export function isSubscriptionValid(status?: SubscriptionStatus | null) {
  return status === "active" || status === "trialing";
}

export function canAccess(
  plan: Plan | null,
  status: SubscriptionStatus | null,
  feature: Feature
) {
  if (!plan || !isSubscriptionValid(status)) return false;
  return PLAN_PERMISSIONS[plan].includes(feature);
}

/**
 * SINGLE SOURCE OF TRUTH FOR APP ACCESS
 */
export function isUserAllowed(
  plan: Plan | null,
  status: SubscriptionStatus | null
) {
  return isSubscriptionValid(status) && !!plan;
}