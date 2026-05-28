export type Plan =
  | "core"
  | "elite";

export type BillingType =
  | "monthly"
  | "annual";

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

/**
 * PLAN FEATURE ACCESS
 */
const PLAN_PERMISSIONS: Record<Plan, Feature[]> = {
  core: [
    "dashboard_access",
    "core_features",
  ],

  elite: [
    "dashboard_access",
    "core_features",
    "elite_features",
  ],
};

/**
 * VALID SUBSCRIPTIONS
 */
export function isSubscriptionValid(
  status: SubscriptionStatus | null | undefined
): boolean {
  if (!status) return false;

  return (
    status === "active" ||
    status === "trialing"
  );
}

/**
 * ACCESS CONTROL
 */
export function canAccess(
  plan: Plan | null | undefined,
  status: SubscriptionStatus | null | undefined,
  feature: Feature
): boolean {
  if (!isSubscriptionValid(status)) {
    return false;
  }

  if (!plan) {
    return false;
  }

  const permissions =
    PLAN_PERMISSIONS[plan];

  if (!permissions) {
    return false;
  }

  return permissions.includes(feature);
}

/**
 * PAID USER
 */
export function isPaidUser(
  plan: Plan | null | undefined
): boolean {
  return !!plan;
}