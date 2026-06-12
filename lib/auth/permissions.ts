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
  | "clinical_intelligence"
  | "lab_trends"
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
    "clinical_intelligence",
    "lab_trends",
  ],

  sovereign: [
    "dashboard_access",
    "core_features",
    "elite_features",
    "proactive_coach",
    "voice_agent",
    "autopilot_calendar",
    "future_self_simulator",
    "advanced_modalities",
    "clinical_intelligence",
    "lab_trends",
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

export type FeatureEntitlement = {
  feature: Feature;
  label: string;
  minimumPlan: Plan;
  description: string;
};

export const FEATURE_ENTITLEMENTS: FeatureEntitlement[] = [
  {
    feature: "dashboard_access",
    label: "Dashboard",
    minimumPlan: "core",
    description: "Core dashboard, assessment, biological age baseline, and reports.",
  },
  {
    feature: "proactive_coach",
    label: "Proactive coach",
    minimumPlan: "elite",
    description: "Email, push, and in-app coach delivery based on health signals.",
  },
  {
    feature: "voice_agent",
    label: "Voice agent",
    minimumPlan: "elite",
    description: "Mobile voice conversations and spoken clinical follow-ups.",
  },
  {
    feature: "autopilot_calendar",
    label: "Autopilot calendar",
    minimumPlan: "elite",
    description: "Daily planning, calendar execution, and approval-based automation.",
  },
  {
    feature: "future_self_simulator",
    label: "Future self simulator",
    minimumPlan: "elite",
    description: "Trajectory modeling and scenario comparisons.",
  },
  {
    feature: "advanced_modalities",
    label: "Advanced modalities",
    minimumPlan: "elite",
    description: "Red light, cold exposure, PEMF, and advanced recovery protocols.",
  },
  {
    feature: "clinical_intelligence",
    label: "Clinical intelligence",
    minimumPlan: "elite",
    description: "Clinical memory, follow-up questions, and higher-depth biomarker reasoning.",
  },
  {
    feature: "lab_trends",
    label: "Lab trends",
    minimumPlan: "elite",
    description: "Longitudinal lab trend intelligence beyond one-off lab import.",
  },
  {
    feature: "digital_twin",
    label: "Digital twin",
    minimumPlan: "sovereign",
    description: "Living health timeline and cross-signal twin intelligence.",
  },
  {
    feature: "physician_exports",
    label: "Physician exports",
    minimumPlan: "sovereign",
    description: "Physician-ready longitudinal export bundle.",
  },
  {
    feature: "sovereign_modalities",
    label: "Sovereign modalities",
    minimumPlan: "sovereign",
    description: "Clinician-reviewed HBOT, epigenetic/telomere tracking, and executive experiments.",
  },
  {
    feature: "concierge_intelligence",
    label: "Concierge intelligence",
    minimumPlan: "sovereign",
    description: "Highest-depth reasoning, review, and white-glove intelligence layers.",
  },
];

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
