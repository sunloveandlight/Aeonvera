import {
  hasMinimumPlan,
  PLAN_LABEL,
  type Plan,
  type SubscriptionStatus,
} from "@/lib/auth/permissions";

export type EvidenceGrade = "foundational" | "promising" | "emerging" | "experimental";
export type ModalityTier = "core" | "elite" | "sovereign";
export type ModalityRisk = "low" | "moderate" | "high";

export type ModalityContext = {
  age?: number | null;
  biologicalAgeDelta?: number | null;
  primaryGoal?: string | null;
  riskTier?: string | null;
  activeClinicalDomains?: string[];
  latestLabs?: Array<{
    canonical_key?: string | null;
    value?: number | string | null;
    unit?: string | null;
  }>;
};

export type LongevityModality = {
  id: string;
  name: string;
  minimumTier: ModalityTier;
  category: "foundation" | "recovery" | "metabolic" | "regeneration" | "clinical";
  evidenceGrade: EvidenceGrade;
  risk: ModalityRisk;
  cost: "low" | "medium" | "high" | "very_high";
  positioning: string;
  idealFor: string[];
  notFor: string[];
  contraindications: string[];
  protocolRange: string;
  track: string[];
  stopIf: string[];
  clinicianReview: boolean;
};

export type TieredModalityRecommendation = LongevityModality & {
  access: "included" | "locked";
  fitScore: number;
  rationale: string;
  upgradeMessage?: string;
};

export const LONGEVITY_MODALITIES: LongevityModality[] = [
  {
    id: "sleep_circadian_foundation",
    name: "Circadian sleep foundation",
    minimumTier: "core",
    category: "foundation",
    evidenceGrade: "foundational",
    risk: "low",
    cost: "low",
    positioning: "The first-line longevity intervention before expensive modalities.",
    idealFor: ["sleep debt", "poor recovery", "glucose instability", "low energy"],
    notFor: ["users unwilling to adjust schedule"],
    contraindications: [],
    protocolRange: "Fixed wake time, morning outdoor light, dim evenings, consistent sleep window for 14 days.",
    track: ["sleep duration", "sleep quality", "resting heart rate", "HRV", "morning energy"],
    stopIf: ["insomnia worsens despite schedule consistency"],
    clinicianReview: false,
  },
  {
    id: "zone2_strength_foundation",
    name: "Zone 2 + resistance training base",
    minimumTier: "core",
    category: "foundation",
    evidenceGrade: "foundational",
    risk: "low",
    cost: "low",
    positioning: "The highest-leverage physical protocol for healthspan, insulin sensitivity, and cardiovascular reserve.",
    idealFor: ["low VO2 max", "metabolic risk", "sarcopenia risk", "high resting heart rate"],
    notFor: ["acute injury without clearance"],
    contraindications: ["unstable chest pain", "unexplained fainting", "uncontrolled hypertension"],
    protocolRange: "2-3 Zone 2 sessions plus 2 full-body resistance sessions weekly.",
    track: ["VO2 max", "resting heart rate", "strength progression", "waist", "recovery"],
    stopIf: ["chest pain", "dizziness", "unusual shortness of breath", "recovery collapses"],
    clinicianReview: true,
  },
  {
    id: "red_light_photobiomodulation",
    name: "Red light / photobiomodulation",
    minimumTier: "elite",
    category: "recovery",
    evidenceGrade: "promising",
    risk: "low",
    cost: "medium",
    positioning: "An optional recovery, skin, and mitochondrial-support layer after sleep/training basics are stable.",
    idealFor: ["skin quality", "joint soreness", "recovery support", "low-risk cellular-support interest"],
    notFor: ["users expecting guaranteed whole-body rejuvenation"],
    contraindications: ["photosensitizing medication without clinician guidance", "active skin cancer concern"],
    protocolRange: "Short targeted sessions 3-5x/week using device-specific dosing and eye protection.",
    track: ["soreness", "skin response", "sleep quality", "recovery score", "subjective energy"],
    stopIf: ["skin irritation", "headache", "eye discomfort", "symptoms worsen"],
    clinicianReview: false,
  },
  {
    id: "cold_exposure",
    name: "Cold exposure protocol",
    minimumTier: "elite",
    category: "metabolic",
    evidenceGrade: "emerging",
    risk: "moderate",
    cost: "low",
    positioning: "A resilience and metabolic-support tool, not a primary fat-loss engine.",
    idealFor: ["stress resilience", "morning alertness", "brown-fat interest", "recovery discipline"],
    notFor: ["users with cardiovascular red flags", "users chasing rapid fat loss"],
    contraindications: ["uncontrolled hypertension", "arrhythmia", "chest pain", "cold urticaria", "Raynaud's severity"],
    protocolRange: "Start with 30-60 seconds cool water, progress gradually, avoid breath-holding or shock intensity.",
    track: ["blood pressure", "resting heart rate", "mood", "sleep", "recovery"],
    stopIf: ["chest pain", "dizziness", "palpitations", "numbness that persists"],
    clinicianReview: true,
  },
  {
    id: "pemf_recovery",
    name: "PEMF recovery mat",
    minimumTier: "elite",
    category: "recovery",
    evidenceGrade: "experimental",
    risk: "moderate",
    cost: "high",
    positioning: "A cautious optional recovery experiment; consumer devices vary and claims should be measured.",
    idealFor: ["recovery tracking", "relaxation experiments", "chronic soreness with conservative expectations"],
    notFor: ["users expecting guaranteed tissue healing from consumer mats"],
    contraindications: ["implanted electronic devices", "pregnancy unless cleared", "seizure disorder unless cleared"],
    protocolRange: "Trial short low-intensity sessions 3-4x/week for 2-4 weeks and compare recovery markers.",
    track: ["HRV", "sleep quality", "pain/soreness score", "training readiness"],
    stopIf: ["sleep worsens", "dizziness", "palpitations", "neurologic symptoms"],
    clinicianReview: true,
  },
  {
    id: "hyperbaric_oxygen",
    name: "Hyperbaric oxygen therapy",
    minimumTier: "sovereign",
    category: "clinical",
    evidenceGrade: "emerging",
    risk: "high",
    cost: "very_high",
    positioning: "A physician-reviewed advanced modality, not a universal longevity recommendation.",
    idealFor: ["high-budget longevity exploration", "clinician-supervised protocols", "advanced recovery context"],
    notFor: ["users looking for a first-line habit", "users without contraindication screening"],
    contraindications: ["untreated pneumothorax", "certain lung disease", "ear/sinus barotrauma risk", "some chemotherapy agents", "seizure risk"],
    protocolRange: "Only through qualified medical supervision with indication, pressure, duration, and safety plan documented.",
    track: ["sleep", "fatigue", "cognition", "inflammation markers", "adverse effects", "clinician notes"],
    stopIf: ["ear pain", "vision changes", "shortness of breath", "neurologic symptoms", "oxygen-toxicity concern"],
    clinicianReview: true,
  },
  {
    id: "epigenetic_telomere_testing",
    name: "Epigenetic and telomere testing",
    minimumTier: "sovereign",
    category: "regeneration",
    evidenceGrade: "emerging",
    risk: "low",
    cost: "high",
    positioning: "A high-end tracking layer for longitudinal experiments, not a standalone diagnosis.",
    idealFor: ["biological-age tracking", "advanced protocol feedback", "executive longitudinal reports"],
    notFor: ["users who have not built a stable baseline first"],
    contraindications: [],
    protocolRange: "Baseline, repeat after 90-180 days, compare against labs, sleep, body composition, and interventions.",
    track: ["epigenetic age", "telomere proxy", "biological age", "inflammation", "body composition"],
    stopIf: ["results drive anxiety or over-testing"],
    clinicianReview: false,
  },
];

export function buildTieredModalityRecommendations({
  context = {},
  plan,
  status,
}: {
  context?: ModalityContext;
  plan: Plan | null;
  status: SubscriptionStatus | null;
}) {
  const recommendations = LONGEVITY_MODALITIES.map((modality) => {
    const included = hasMinimumPlan(plan, status, modality.minimumTier);
    const fitScore = scoreModalityFit(modality, context);

    return {
      ...modality,
      access: included ? "included" : "locked",
      fitScore,
      rationale: buildModalityRationale(modality, context, fitScore),
      upgradeMessage: included
        ? undefined
        : `Available in ${PLAN_LABEL[modality.minimumTier]}. Your current tier can learn about it, but Aeonvera will not turn it into an active protocol until upgraded.`,
    } satisfies TieredModalityRecommendation;
  }).sort((a, b) => {
    if (a.access !== b.access) return a.access === "included" ? -1 : 1;
    return b.fitScore - a.fitScore;
  });

  return {
    currentPlan: plan,
    recommendations,
    tiers: TIER_FEATURE_MATRIX,
  };
}

export const TIER_FEATURE_MATRIX = {
  core: {
    headline: "Baseline health intelligence",
    included: [
      "Biological age baseline",
      "Assessment and dashboard",
      "Core lab upload and clinical flagging",
      "Foundational sleep, nutrition, walking, Zone 2, and strength protocols",
    ],
    excluded: [
      "Advanced modalities",
      "Autopilot scheduling",
      "Digital twin exports",
      "Concierge-level clinical experiments",
    ],
  },
  elite: {
    headline: "Continuous optimization system",
    included: [
      "Everything in Core",
      "Proactive coach messages",
      "Advanced biomarker interpretation",
      "Wearable-informed daily plans",
      "Elite modalities: red light, cold exposure, PEMF experiments, sauna-style recovery logic",
    ],
    excluded: [
      "Clinician-reviewed HBOT guidance",
      "Epigenetic/telomere experiment tracking",
      "Physician-ready executive export layer",
    ],
  },
  sovereign: {
    headline: "Executive health intelligence layer",
    included: [
      "Everything in Elite",
      "Sovereign modalities: HBOT, epigenetic/telomere testing, advanced imaging/lab strategy",
      "Digital twin timeline and physician-ready export path",
      "Concierge-level data integration and protocol review",
      "Highest-depth scenario modeling and family/account readiness",
    ],
    excluded: [],
  },
} as const;

function scoreModalityFit(modality: LongevityModality, context: ModalityContext) {
  const haystack = [
    context.primaryGoal,
    context.riskTier,
    ...(context.activeClinicalDomains || []),
    ...(context.latestLabs || []).map((lab) => lab.canonical_key),
  ].join(" ").toLowerCase();

  let score = modality.minimumTier === "core" ? 70 : modality.minimumTier === "elite" ? 55 : 42;

  for (const fit of modality.idealFor) {
    if (haystack.includes(fit.split(" ")[0].toLowerCase())) score += 8;
  }

  if (/recovery|sleep|hrv|stress|inflammation|hscrp/.test(haystack) && modality.category === "recovery") {
    score += 16;
  }

  if (/glucose|insulin|triglycerides|hdl|metabolic|waist/.test(haystack) && modality.category === "metabolic") {
    score += 16;
  }

  if (/telomere|epigenetic|biological age|advanced|executive/.test(haystack) && modality.minimumTier === "sovereign") {
    score += 14;
  }

  if (modality.risk === "high") score -= 10;
  if (context.riskTier === "urgent" || context.riskTier === "clinician_review") score -= modality.clinicianReview ? 6 : 18;

  return Math.max(10, Math.min(96, Math.round(score)));
}

function buildModalityRationale(
  modality: LongevityModality,
  context: ModalityContext,
  fitScore: number
) {
  const contextText = [
    context.primaryGoal ? `goal: ${context.primaryGoal}` : null,
    context.riskTier ? `risk tier: ${context.riskTier}` : null,
    context.activeClinicalDomains?.length
      ? `active domains: ${context.activeClinicalDomains.slice(0, 3).join(", ")}`
      : null,
  ].filter(Boolean).join("; ");

  return `${modality.positioning} Fit score ${fitScore}/100${contextText ? ` based on ${contextText}` : ""}. Evidence is ${modality.evidenceGrade}; risk is ${modality.risk}.`;
}
