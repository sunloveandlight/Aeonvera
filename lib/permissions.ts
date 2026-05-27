// lib/permissions.ts

export type Plan = "free" | "core" | "elite" | "sovereign";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled";

export type Feature =
  | "dashboard_access"
  | "core_features"
  | "elite_features"
  | "sovereign_features"
  | "admin_access";

/**
 * 🧠 PLAN → FEATURE MAP
 */
const PLAN_PERMISSIONS: Record<Plan, Feature[]> = {
  free: ["dashboard_access"],

  core: [
    "dashboard_access",
    "core_features",
  ],

  elite: [
    "dashboard_access",
    "core_features",
    "elite_features",
  ],

  sovereign: [
    "dashboard_access",
    "core_features",
    "elite_features",
    "sovereign_features",
  ],
};

/**
 * 🚨 STATUS RULES (VERY IMPORTANT)
 * This controls whether ANY access is allowed at all
 */
export function isSubscriptionValid(status: SubscriptionStatus | null | undefined): boolean {
  if (!status) return false;

  return status === "active" || status === "trialing";
}

/**
 * 🧠 MAIN ACCESS FUNCTION
 * This is the ONLY function you should use in your app later
 */
export function canAccess(
  plan: Plan | null | undefined,
  status: SubscriptionStatus | null | undefined,
  feature: Feature
): boolean {
  // 1. Block invalid subscriptions first
  if (!isSubscriptionValid(status)) return false;

  // 2. No plan = no access
  if (!plan) return false;

  // 3. Check feature permission
  const permissions = PLAN_PERMISSIONS[plan];

  if (!permissions) return false;

  return permissions.includes(feature);
}

/**
 * 🎯 SIMPLE HELPERS (for UI later)
 */
export function isPaidUser(plan: Plan | null | undefined): boolean {
  return plan !== "free" && !!plan;
}