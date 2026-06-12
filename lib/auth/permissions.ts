export type Plan = "core" | "elite" | "sovereign";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "inactive";

export type Feature =
  | "dashboard_access"
  | "core_features"
  | "elite_features"
  | "proactive_coach"
  | "advanced_modalities"
  | "digital_twin"
  | "physician_exports"
  | "sovereign_modalities"
  | "concierge_intelligence";

const PLAN_PERMISSIONS: Record<Plan, Feature[]> = {
  core: [
    "dashboard_access",
    "core_features",
  ],

  elite: [
    "dashboard_access",
    "core_features",
    "elite_features",
    "proactive_coach",
    "advanced_modalities",
  ],

  sovereign: [
    "dashboard_access",
    "core_features",
    "elite_features",
    "proactive_coach",
    "advanced_modalities",
    "digital_twin",
    "physician_exports",
    "sovereign_modalities",
    "concierge_intelligence",
  ],
};

export const PLAN_RANK: Record<Plan, number> = {
  core: 1,
  elite: 2,
  sovereign: 3,
};

export const PLAN_LABEL: Record<Plan, string> = {
  core: "Core",
  elite: "Elite",
  sovereign: "Sovereign",
};

export function isSubscriptionValid(
  status?: SubscriptionStatus | null
) {
  return (
    status === "active" ||
    status === "trialing"
  );
}

export function canAccess(
  plan: Plan | null,
  status: SubscriptionStatus | null,
  feature: Feature
) {
  if (!plan || !isSubscriptionValid(status)) {
    return false;
  }

  return PLAN_PERMISSIONS[plan].includes(feature);
}

export function hasMinimumPlan(
  plan: Plan | null,
  status: SubscriptionStatus | null,
  minimumPlan: Plan
) {
  if (!plan || !isSubscriptionValid(status)) return false;
  return PLAN_RANK[plan] >= PLAN_RANK[minimumPlan];
}

export function requiredUpgrade(
  plan: Plan | null,
  status: SubscriptionStatus | null,
  minimumPlan: Plan
) {
  if (hasMinimumPlan(plan, status, minimumPlan)) return null;

  return {
    currentPlan: plan,
    minimumPlan,
    message: `Upgrade to ${PLAN_LABEL[minimumPlan]} to unlock this layer.`,
  };
}

/**
 * SINGLE SOURCE OF TRUTH FOR APP ACCESS
 */
export function isUserAllowed(
  plan: Plan | null,
  status: SubscriptionStatus | null
) {
  return (
    !!plan &&
    isSubscriptionValid(status)
  );
}
