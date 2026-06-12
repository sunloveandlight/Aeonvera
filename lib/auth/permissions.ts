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
  | "voice_agent"
  | "autopilot_calendar"
  | "future_self_simulator"
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
    "voice_agent",
    "autopilot_calendar",
    "future_self_simulator",
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

export type UsageMeter =
  | "agent_question"
  | "voice_question"
  | "report_generation"
  | "optimization_protocol"
  | "future_self_simulation"
  | "lab_import";

export type UsageLimit = {
  monthly: number;
  label: string;
};

export const PLAN_USAGE_LIMITS: Record<Plan, Record<UsageMeter, UsageLimit>> = {
  core: {
    agent_question: { monthly: 100, label: "AI health questions" },
    voice_question: { monthly: 0, label: "voice conversations" },
    report_generation: { monthly: 4, label: "AI longevity reports" },
    optimization_protocol: { monthly: 4, label: "optimization protocols" },
    future_self_simulation: { monthly: 0, label: "future-self simulations" },
    lab_import: { monthly: 5, label: "lab imports" },
  },

  elite: {
    agent_question: { monthly: 1000, label: "AI health questions" },
    voice_question: { monthly: 250, label: "voice conversations" },
    report_generation: { monthly: 30, label: "AI longevity reports" },
    optimization_protocol: { monthly: 30, label: "optimization protocols" },
    future_self_simulation: { monthly: 300, label: "future-self simulations" },
    lab_import: { monthly: 25, label: "lab imports" },
  },

  sovereign: {
    agent_question: { monthly: 10000, label: "AI health questions" },
    voice_question: { monthly: 2000, label: "voice conversations" },
    report_generation: { monthly: 300, label: "AI longevity reports" },
    optimization_protocol: { monthly: 300, label: "optimization protocols" },
    future_self_simulation: { monthly: 3000, label: "future-self simulations" },
    lab_import: { monthly: 250, label: "lab imports" },
  },
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

export function getUsageLimit(
  plan: Plan | null,
  status: SubscriptionStatus | null,
  meter: UsageMeter
) {
  if (!plan || !isSubscriptionValid(status)) return null;
  return PLAN_USAGE_LIMITS[plan][meter];
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
