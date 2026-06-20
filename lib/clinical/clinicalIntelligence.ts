import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClinicalBiomarkerKey } from "@/lib/labs/clinicalBiomarkers";

export type ClinicalRiskTier = "optimize" | "monitor" | "clinician_review" | "urgent";

export type ClinicalBiomarkerRow = {
  canonical_key: ClinicalBiomarkerKey;
  value: number | string;
  unit?: string | null;
  raw_label?: string | null;
  measured_at?: string | null;
};

export type ClinicalProfileContext = {
  age?: number;
  sex?: "male" | "female" | "unknown";
  familyCancer?: string;
  familyDiabetes?: string;
  familyHeartDisease?: string;
  bodyFatPct?: number;
  waistCm?: number;
};

export type ClinicalRangeFlag = {
  action: string;
  context?: string;
  domain: string;
  key: ClinicalBiomarkerKey;
  label: string;
  rationale: string;
  tier: ClinicalRiskTier;
  unit: string | null;
  value: number;
};

export type MissingClinicalInput = {
  domain: string;
  key: ClinicalBiomarkerKey | string;
  label: string;
  reason: string;
  priority: "high" | "medium" | "low";
};

export type ClinicalIntelligenceSummary = {
  confidence: number;
  domains: string[];
  followUpQuestions: string[];
  missingInputs: MissingClinicalInput[];
  recommendedActions: Array<{
    action: string;
    domain: string;
    why: string;
    impact: "low" | "medium" | "high";
  }>;
  riskTier: ClinicalRiskTier;
  signalMap: Array<{
    domain: string;
    missing: string[];
    present: string[];
    tier: ClinicalRiskTier;
  }>;
  summary: string;
  rangeFlags: ClinicalRangeFlag[];
};

type MarkerDefinition = {
  action: string;
  domain: string;
  key: ClinicalBiomarkerKey;
  label: string;
  optimal?: [number, number];
  monitor?: [number, number];
  clinicianReview?: [number, number];
  urgent?: [number, number];
  lowerIsBetter?: boolean;
  unit: string;
};

const MARKERS: MarkerDefinition[] = [
  {
    action: "Stabilize fasting glucose with sleep consistency, post-meal walking, and protein-forward first meals.",
    domain: "Metabolic",
    key: "fasting_glucose",
    label: "Fasting glucose",
    optimal: [70, 90],
    monitor: [91, 99],
    clinicianReview: [100, 125],
    urgent: [126, Number.POSITIVE_INFINITY],
    lowerIsBetter: true,
    unit: "mg/dL",
  },
  {
    action: "Pair glucose interpretation with fasting insulin to estimate metabolic flexibility.",
    domain: "Metabolic",
    key: "fasting_insulin",
    label: "Fasting insulin",
    optimal: [2, 8],
    monitor: [8.1, 12],
    clinicianReview: [12.1, Number.POSITIVE_INFINITY],
    lowerIsBetter: true,
    unit: "uIU/mL",
  },
  {
    action: "Reduce glycemic load and strengthen Zone 2/resistance training consistency.",
    domain: "Metabolic",
    key: "hba1c",
    label: "HbA1c",
    optimal: [4.8, 5.4],
    monitor: [5.5, 5.6],
    clinicianReview: [5.7, 6.4],
    urgent: [6.5, Number.POSITIVE_INFINITY],
    lowerIsBetter: true,
    unit: "%",
  },
  {
    action: "Prioritize triglyceride reduction through alcohol moderation, refined-carb reduction, and aerobic base work.",
    domain: "Cardiometabolic",
    key: "triglycerides",
    label: "Triglycerides",
    optimal: [0, 100],
    monitor: [101, 149],
    clinicianReview: [150, 499],
    urgent: [500, Number.POSITIVE_INFINITY],
    lowerIsBetter: true,
    unit: "mg/dL",
  },
  {
    action: "Use HDL together with triglycerides, ApoB, blood pressure, and insulin rather than treating it alone.",
    domain: "Cardiometabolic",
    key: "hdl_cholesterol",
    label: "HDL cholesterol",
    optimal: [60, Number.POSITIVE_INFINITY],
    monitor: [40, 59],
    clinicianReview: [0, 39],
    unit: "mg/dL",
  },
  {
    action: "Review ApoB or LDL particle risk before assuming LDL alone captures cardiovascular exposure.",
    domain: "Cardiovascular",
    key: "apob",
    label: "ApoB",
    optimal: [0, 80],
    monitor: [81, 99],
    clinicianReview: [100, Number.POSITIVE_INFINITY],
    lowerIsBetter: true,
    unit: "mg/dL",
  },
  {
    action: "Reduce inflammatory load and look for sleep, oral health, visceral fat, infection, or overtraining drivers.",
    domain: "Inflammation",
    key: "hscrp",
    label: "hs-CRP",
    optimal: [0, 1],
    monitor: [1.01, 2.99],
    clinicianReview: [3, 9.99],
    urgent: [10, Number.POSITIVE_INFINITY],
    lowerIsBetter: true,
    unit: "mg/L",
  },
  {
    action: "Treat high blood pressure as a cardiovascular exposure signal and confirm with repeated home readings.",
    domain: "Cardiovascular",
    key: "blood_pressure_systolic",
    label: "Systolic blood pressure",
    optimal: [90, 119],
    monitor: [120, 129],
    clinicianReview: [130, 179],
    urgent: [180, Number.POSITIVE_INFINITY],
    lowerIsBetter: true,
    unit: "mmHg",
  },
  {
    action: "Treat high blood pressure as a cardiovascular exposure signal and confirm with repeated home readings.",
    domain: "Cardiovascular",
    key: "blood_pressure_diastolic",
    label: "Diastolic blood pressure",
    optimal: [60, 79],
    monitor: [80, 89],
    clinicianReview: [90, 119],
    urgent: [120, Number.POSITIVE_INFINITY],
    lowerIsBetter: true,
    unit: "mmHg",
  },
  {
    action: "Pair ferritin with CBC, inflammation markers, iron studies, symptoms, and sex-specific context.",
    domain: "Inflammation / Iron",
    key: "ferritin",
    label: "Ferritin",
    optimal: [30, 150],
    monitor: [151, 300],
    clinicianReview: [0, 29],
    unit: "ng/mL",
  },
  {
    action: "Interpret TSH with Free T3, Free T4, symptoms, medications, and clinician context.",
    domain: "Hormonal / Thyroid",
    key: "tsh",
    label: "TSH",
    optimal: [0.5, 2.5],
    monitor: [2.51, 4.5],
    clinicianReview: [4.51, Number.POSITIVE_INFINITY],
    unit: "mIU/L",
  },
  {
    action: "Bring vitamin D into a steady adequate range while avoiding excessive dosing.",
    domain: "Micronutrients",
    key: "vitamin_d",
    label: "Vitamin D",
    optimal: [30, 60],
    monitor: [20, 29],
    clinicianReview: [0, 19],
    unit: "ng/mL",
  },
  {
    action: "Interpret testosterone with symptoms, sleep, resistance training, body composition, SHBG, LH/FSH, and clinician context.",
    domain: "Hormonal",
    key: "total_testosterone",
    label: "Total testosterone",
    optimal: [450, 900],
    monitor: [300, 449],
    clinicianReview: [0, 299],
    unit: "ng/dL",
  },
];

const DOMAIN_REQUIREMENTS: Array<{
  domain: string;
  keys: ClinicalBiomarkerKey[];
  reason: string;
}> = [
  {
    domain: "Metabolic",
    keys: ["fasting_glucose", "fasting_insulin", "hba1c", "triglycerides", "hdl_cholesterol"],
    reason: "Metabolic flexibility needs glucose exposure, insulin response, and lipid response together.",
  },
  {
    domain: "Cardiovascular",
    keys: ["blood_pressure_systolic", "blood_pressure_diastolic", "apob", "triglycerides", "hdl_cholesterol"],
    reason: "Cardiovascular risk is clearer with pressure, lipid particle burden, and metabolic context.",
  },
  {
    domain: "Inflammation / Recovery",
    keys: ["hscrp", "ferritin", "homocysteine", "esr", "fibrinogen"],
    reason: "Inflammation needs more than one marker to distinguish recovery strain from clinical review signals.",
  },
  {
    domain: "Hormonal / Thyroid",
    keys: ["tsh", "free_t3", "free_t4", "morning_cortisol"],
    reason: "Hormonal interpretation needs axis context rather than a single isolated number.",
  },
  {
    domain: "Body Composition / Hematology",
    keys: ["albumin", "creatinine", "white_blood_cell_count", "lymphocyte_pct", "red_cell_distribution_width"],
    reason: "CBC and protein/kidney markers improve recovery, sarcopenia, and systemic resilience interpretation.",
  },
];

export function buildClinicalIntelligence(rows: ClinicalBiomarkerRow[]): ClinicalIntelligenceSummary {
  return buildClinicalIntelligenceWithContext(rows);
}

export function buildClinicalIntelligenceWithContext(
  rows: ClinicalBiomarkerRow[],
  context: ClinicalProfileContext = {}
): ClinicalIntelligenceSummary {
  const latest = latestBiomarkers(rows);
  const rangeFlags = Array.from(latest.values())
    .map((row) => buildRangeFlag(row, context))
    .filter((flag): flag is ClinicalRangeFlag => Boolean(flag))
    .sort((a, b) => tierWeight(b.tier) - tierWeight(a.tier));
  const signalMap = DOMAIN_REQUIREMENTS.map((requirement) => {
    const present = requirement.keys.filter((key) => latest.has(key)).map(readableKey);
    const missing = requirement.keys.filter((key) => !latest.has(key)).map(readableKey);
    const domainFlags = rangeFlags.filter((flag) => flag.domain === requirement.domain);

    return {
      domain: requirement.domain,
      missing,
      present,
      tier: highestTier(domainFlags.map((flag) => flag.tier)),
    };
  });
  const missingInputs = buildMissingInputs(latest, context);
  const riskTier = highestTier(rangeFlags.map((flag) => flag.tier));
  const confidence = computeConfidence(latest.size, missingInputs, context);
  const recommendedActions = buildRecommendedActions(rangeFlags, missingInputs);
  const followUpQuestions = buildFollowUpQuestions(rangeFlags, missingInputs, context);

  return {
    confidence,
    domains: signalMap.filter((domain) => domain.present.length).map((domain) => domain.domain),
    followUpQuestions,
    missingInputs,
    recommendedActions,
    riskTier,
    signalMap,
    summary: buildSummary({ confidence, context, missingInputs, rangeFlags, riskTier }),
    rangeFlags,
  };
}

export async function createClinicalInsightFromLabs({
  healthProfileId,
  sourceQuestion = "Clinical lab import",
  supabase,
  userId,
}: {
  healthProfileId?: string | null;
  sourceQuestion?: string;
  supabase: SupabaseClient;
  userId: string;
}) {
  const query = supabase
    .from("lab_biomarkers")
    .select("canonical_key,value,unit,raw_label,measured_at")
    .eq(healthProfileId ? "health_profile_id" : "user_id", healthProfileId || userId)
    .order("measured_at", { ascending: false })
    .limit(160);

  const { data, error } = await query;

  const context = await loadClinicalProfileContext(supabase, userId, healthProfileId);
  const assessmentRows = context.assessment
    ? assessmentToBiomarkerRows(context.assessment)
    : [];

  if (error) {
    if (!isMissingTable(error)) {
      console.error("[Clinical Intelligence Lab Load Error]", error.message);
    }

    return null;
  }

  const intelligence = buildClinicalIntelligenceWithContext(
    [...((data || []) as ClinicalBiomarkerRow[]), ...assessmentRows],
    context.profile
  );
  if (!intelligence.rangeFlags.length && intelligence.confidence < 20) return null;

  const { error: insertError } = await supabase.from("clinical_insights").insert({
    ...(healthProfileId ? { health_profile_id: healthProfileId } : {}),
    user_id: userId,
    source: "system",
    source_question: sourceQuestion,
    answer_summary: intelligence.summary,
    domains: intelligence.domains.slice(0, 6),
    concern_status:
      intelligence.riskTier === "urgent" || intelligence.riskTier === "clinician_review"
        ? "unresolved"
        : "monitoring",
    confidence: intelligence.confidence / 100,
    signal_map: intelligence.signalMap,
    range_flags: intelligence.rangeFlags,
    follow_up_questions: intelligence.followUpQuestions,
    recommended_actions: intelligence.recommendedActions,
    metadata: {
      generated_from: "lab_import",
      missing_inputs: intelligence.missingInputs,
      profile_context: compactProfileContext(context.profile),
      risk_tier: intelligence.riskTier,
      safety_level:
        intelligence.riskTier === "urgent"
          ? "urgent"
          : intelligence.riskTier === "clinician_review"
          ? "medical_review"
          : intelligence.riskTier === "monitor"
          ? "monitor"
          : "routine",
      status_reason: tierReason(intelligence.riskTier),
      generated_at: new Date().toISOString(),
    },
  });

  if (insertError && !isMissingTable(insertError)) {
    console.error("[Clinical Intelligence Store Error]", insertError.message);
  }

  return intelligence;
}

function latestBiomarkers(rows: ClinicalBiomarkerRow[]) {
  const latest = new Map<ClinicalBiomarkerKey, ClinicalBiomarkerRow & { numericValue: number }>();

  for (const row of rows) {
    const numericValue = normalizeValue(row);
    if (!Number.isFinite(numericValue)) continue;

    const existing = latest.get(row.canonical_key);
    if (
      !existing ||
      new Date(row.measured_at || 0).getTime() > new Date(existing.measured_at || 0).getTime()
    ) {
      latest.set(row.canonical_key, { ...row, numericValue });
    }
  }

  return latest;
}

function buildRangeFlag(
  row: ClinicalBiomarkerRow & { numericValue: number },
  context: ClinicalProfileContext
): ClinicalRangeFlag | null {
  const definition = MARKERS.find((marker) => marker.key === row.canonical_key);
  if (!definition) return null;

  const tier = classifyValue(row.numericValue, definition, context);
  const readableValue = `${round(row.numericValue)} ${definition.unit}`;
  const contextNote = buildContextNote(row.canonical_key, tier, context);

  return {
    action: definition.action,
    context: contextNote,
    domain: definition.domain,
    key: row.canonical_key,
    label: definition.label,
    rationale: `${definition.label} is ${readableValue}. ${tierReason(tier)}${contextNote ? ` ${contextNote}` : ""}`,
    tier,
    unit: definition.unit,
    value: round(row.numericValue),
  };
}

function classifyValue(
  value: number,
  definition: MarkerDefinition,
  context: ClinicalProfileContext
): ClinicalRiskTier {
  if (definition.key === "hdl_cholesterol") {
    const lowCutoff = context.sex === "female" ? 50 : 40;
    if (value < lowCutoff) return "clinician_review";
    if (value < 60) return "monitor";
    return "optimize";
  }

  if (definition.key === "ferritin") {
    if (context.sex === "male") {
      if (value < 30 || value > 300) return "clinician_review";
      if (value < 50 || value > 200) return "monitor";
      return "optimize";
    }

    if (context.sex === "female") {
      if (value < 15 || value > 200) return "clinician_review";
      if (value < 30 || value > 150) return "monitor";
      return "optimize";
    }
  }

  if (definition.key === "total_testosterone") {
    if (context.sex === "male") {
      if (value < 300 || value > 1100) return "clinician_review";
      if (value < 450 || value > 900) return "monitor";
      return "optimize";
    }

    if (context.sex === "female" && value > 70) return "clinician_review";
    return "monitor";
  }

  if (inRange(value, definition.urgent)) return "urgent";
  if (inRange(value, definition.clinicianReview)) return "clinician_review";
  if (inRange(value, definition.monitor)) return "monitor";
  if (inRange(value, definition.optimal)) return "optimize";

  if (definition.lowerIsBetter && definition.optimal?.[1] != null && value > definition.optimal[1]) {
    return "monitor";
  }

  return "monitor";
}

function buildMissingInputs(
  latest: Map<ClinicalBiomarkerKey, ClinicalBiomarkerRow>,
  context: ClinicalProfileContext
) {
  return DOMAIN_REQUIREMENTS.flatMap((requirement) =>
    requirement.keys
      .filter((key) => !latest.has(key))
      .slice(0, 3)
      .map((key, index) => ({
        domain: requirement.domain,
        key,
        label: readableKey(key),
        priority: missingPriority(requirement.domain, key, index, context),
        reason: missingReason(requirement.reason, key, context),
      }))
  ).slice(0, 8) as MissingClinicalInput[];
}

function buildRecommendedActions(
  flags: ClinicalRangeFlag[],
  missingInputs: MissingClinicalInput[]
): ClinicalIntelligenceSummary["recommendedActions"] {
  const actions = flags
    .filter((flag) => flag.tier !== "optimize")
    .slice(0, 4)
    .map((flag) => ({
      action: flag.tier === "urgent" || flag.tier === "clinician_review"
        ? `Review ${flag.label} with a clinician before treating it as a normal optimization target.`
        : flag.action,
      domain: flag.domain,
      impact: (flag.tier === "monitor" ? "medium" : "high") as "medium" | "high",
      why: flag.rationale,
    }));

  if (actions.length < 3 && missingInputs.length) {
    actions.push({
      action: `Add ${missingInputs.slice(0, 3).map((input) => input.label).join(", ")} to raise interpretation confidence.`,
      domain: "Missing data",
      impact: "medium",
      why: "These inputs would materially change the clinical interpretation.",
    });
  }

  return actions.slice(0, 4);
}

function buildFollowUpQuestions(
  flags: ClinicalRangeFlag[],
  missingInputs: MissingClinicalInput[],
  context: ClinicalProfileContext
) {
  const questions = flags.slice(0, 3).map((flag) => {
    if (flag.tier === "urgent" || flag.tier === "clinician_review") {
      return `Has ${flag.label} been reviewed with a clinician, and was this value repeated or confirmed?`;
    }

    return `What changed recently that could explain ${flag.label}: sleep, nutrition, training load, stress, illness, medication, or alcohol?`;
  });

  if (missingInputs.length) {
    questions.push(
      `Can you add ${missingInputs.slice(0, 3).map((input) => input.label).join(", ")} so Aeonvera can resolve the biggest uncertainty?`
    );
  }

  if (context.familyHeartDisease && isAffirmative(context.familyHeartDisease)) {
    questions.push("At what age did the closest first-degree relative develop cardiovascular disease, and was ApoB or Lp(a) ever measured?");
  }

  if (context.sex === "female") {
    questions.push("Are you premenopausal, perimenopausal, postmenopausal, pregnant, or using hormonal contraception or hormone therapy?");
  }

  return questions.slice(0, 5);
}

function buildSummary({
  confidence,
  context,
  missingInputs,
  rangeFlags,
  riskTier,
}: {
  confidence: number;
  context: ClinicalProfileContext;
  missingInputs: MissingClinicalInput[];
  rangeFlags: ClinicalRangeFlag[];
  riskTier: ClinicalRiskTier;
}) {
  const topFlags = rangeFlags.filter((flag) => flag.tier !== "optimize").slice(0, 3);
  const flagText = topFlags.length
    ? topFlags.map((flag) => `${flag.label} is ${flag.tier.replace("_", " ")}`).join("; ")
    : "loaded markers are mostly in optimization range";
  const missingText = missingInputs.length
    ? `Highest-yield missing data: ${missingInputs.slice(0, 3).map((input) => input.label).join(", ")}.`
    : "Missing-data burden is low for the current lab layer.";

  const contextText = profileContextLabel(context);

  return `Clinical intelligence is ${confidence}% confident${contextText ? ` using ${contextText}` : ""}. Risk tier: ${riskTier.replace("_", " ")}. ${flagText}. ${missingText}`;
}

function computeConfidence(
  markerCount: number,
  missingInputs: MissingClinicalInput[],
  context: ClinicalProfileContext
) {
  const totalExpected = Array.from(new Set(DOMAIN_REQUIREMENTS.flatMap((domain) => domain.keys))).length;
  const coverage = markerCount / Math.max(1, totalExpected);
  const missingPenalty = Math.min(0.28, missingInputs.filter((input) => input.priority === "high").length * 0.035);
  const contextBonus = (context.age ? 0.04 : 0) + (context.sex && context.sex !== "unknown" ? 0.04 : 0);
  return Math.max(10, Math.min(95, Math.round((coverage + contextBonus - missingPenalty) * 100)));
}

function normalizeValue(row: ClinicalBiomarkerRow) {
  const value = Number(row.value);
  const unit = row.unit?.toLowerCase() || "";

  if (!Number.isFinite(value)) return Number.NaN;
  if (row.canonical_key === "fasting_glucose" && unit.includes("mmol")) return value * 18.0182;
  if (["triglycerides", "hdl_cholesterol", "ldl_cholesterol", "total_cholesterol"].includes(row.canonical_key) && unit.includes("mmol")) {
    return value * (row.canonical_key === "triglycerides" ? 88.57 : 38.67);
  }
  if (row.canonical_key === "fasting_insulin" && unit.includes("pmol")) return value / 6.945;
  if (row.canonical_key === "hscrp" && unit.includes("mg/dl")) return value * 10;
  if (row.canonical_key === "apob" && unit === "g/l") return value * 100;
  if (row.canonical_key === "fibrinogen" && unit === "g/l") return value * 100;
  if (row.canonical_key === "total_testosterone" && unit.includes("nmol")) return value * 28.85;
  if (row.canonical_key === "free_testosterone" && unit === "ng/dl") return value * 10;
  if (row.canonical_key === "morning_cortisol" && unit.includes("nmol")) return value / 27.59;
  if (row.canonical_key === "vitamin_d" && unit.includes("nmol")) return value / 2.5;
  return value;
}

function highestTier(tiers: ClinicalRiskTier[]) {
  return tiers.sort((a, b) => tierWeight(b) - tierWeight(a))[0] || "optimize";
}

function tierWeight(tier: ClinicalRiskTier) {
  return { optimize: 0, monitor: 1, clinician_review: 2, urgent: 3 }[tier];
}

function tierReason(tier: ClinicalRiskTier) {
  if (tier === "urgent") return "This is a red-flag range that warrants prompt medical review.";
  if (tier === "clinician_review") return "This should be reviewed clinically before normal optimization.";
  if (tier === "monitor") return "This is not automatically dangerous, but it deserves trend monitoring and context.";
  return "This sits in the current optimization range.";
}

function inRange(value: number, range?: [number, number]) {
  if (!range) return false;
  return value >= range[0] && value <= range[1];
}

function readableKey(key: ClinicalBiomarkerKey | string) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace("Hba1c", "HbA1c")
    .replace("Hscrp", "hs-CRP")
    .replace("Apob", "ApoB")
    .replace("Tsh", "TSH")
    .replace("Hdl", "HDL")
    .replace("Ldl", "LDL");
}

async function loadClinicalProfileContext(
  supabase: SupabaseClient,
  userId: string,
  healthProfileId?: string | null
) {
  const query = supabase
    .from("longevity_assessments")
    .select("*")
    .eq(healthProfileId ? "health_profile_id" : "user_id", healthProfileId || userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: assessment, error } = await query;

  if (error) {
    console.error("[Clinical Intelligence Context Error]", error.message);
  }

  return {
    assessment: (assessment || null) as Record<string, unknown> | null,
    profile: assessmentToProfileContext((assessment || null) as Record<string, unknown> | null),
  };
}

function assessmentToProfileContext(assessment: Record<string, unknown> | null): ClinicalProfileContext {
  if (!assessment) return {};

  return {
    age: safeNumber(assessment.age),
    bodyFatPct: safeNumber(assessment.body_fat_pct),
    familyCancer: safeString(assessment.family_cancer),
    familyDiabetes: safeString(assessment.family_diabetes),
    familyHeartDisease: safeString(assessment.family_heart_disease),
    sex: normalizeSex(assessment.sex),
    waistCm: safeNumber(assessment.waist_cm),
  };
}

function assessmentToBiomarkerRows(assessment: Record<string, unknown>): ClinicalBiomarkerRow[] {
  const measuredAt = safeString(assessment.created_at) || new Date().toISOString();
  const mapping: Array<[string, ClinicalBiomarkerKey, string]> = [
    ["blood_pressure_systolic", "blood_pressure_systolic", "mmHg"],
    ["blood_pressure_diastolic", "blood_pressure_diastolic", "mmHg"],
    ["fasting_glucose", "fasting_glucose", "mg/dL"],
    ["fasting_insulin", "fasting_insulin", "uIU/mL"],
    ["hba1c", "hba1c", "%"],
    ["triglycerides", "triglycerides", "mg/dL"],
    ["hdl", "hdl_cholesterol", "mg/dL"],
    ["ldl", "ldl_cholesterol", "mg/dL"],
    ["total_cholesterol", "total_cholesterol", "mg/dL"],
    ["hscrp", "hscrp", "mg/L"],
    ["testosterone", "total_testosterone", "ng/dL"],
    ["cortisol", "morning_cortisol", "ug/dL"],
  ];

  return mapping.flatMap(([assessmentKey, canonicalKey, unit]) => {
    const value = safeNumber(assessment[assessmentKey]);
    if (value == null) return [];

    return [{
      canonical_key: canonicalKey,
      measured_at: measuredAt,
      raw_label: `Assessment ${readableKey(canonicalKey)}`,
      unit,
      value,
    }];
  });
}

function buildContextNote(
  key: ClinicalBiomarkerKey,
  tier: ClinicalRiskTier,
  context: ClinicalProfileContext
) {
  const notes: string[] = [];
  const isCardiometabolic = [
    "apob",
    "blood_pressure_systolic",
    "blood_pressure_diastolic",
    "fasting_glucose",
    "hba1c",
    "hdl_cholesterol",
    "triglycerides",
  ].includes(key);

  if (isCardiometabolic && context.age && context.age >= 45 && tier !== "optimize") {
    notes.push("Age context increases the value of trend confirmation and clinician-grade risk stratification.");
  }

  if (isCardiometabolic && context.familyHeartDisease && isAffirmative(context.familyHeartDisease)) {
    notes.push("Family cardiovascular history makes ApoB, blood pressure, and glycemic context more important.");
  }

  if (["fasting_glucose", "hba1c", "fasting_insulin", "triglycerides"].includes(key) && context.waistCm) {
    notes.push(`Waist context is ${round(context.waistCm)} cm, which should be interpreted with metabolic markers.`);
  }

  if (key === "ferritin" && context.sex && context.sex !== "unknown") {
    notes.push(`Ferritin was interpreted with ${context.sex} context.`);
  }

  if (key === "hdl_cholesterol" && context.sex && context.sex !== "unknown") {
    notes.push(`HDL was interpreted with ${context.sex} context.`);
  }

  if (key === "total_testosterone") {
    if (context.sex === "male") {
      notes.push("Male testosterone context was used; SHBG, LH, FSH, symptoms, and repeat morning timing still matter.");
    } else {
      notes.push("Testosterone is highly context-dependent outside male reference interpretation, so Aeonvera keeps this as clinician-context guidance.");
    }
  }

  return notes.join(" ");
}

function missingPriority(
  domain: string,
  key: ClinicalBiomarkerKey,
  index: number,
  context: ClinicalProfileContext
): "high" | "medium" | "low" {
  if (
    context.familyHeartDisease &&
    isAffirmative(context.familyHeartDisease) &&
    ["apob", "blood_pressure_systolic", "blood_pressure_diastolic"].includes(key)
  ) {
    return "high";
  }

  if (
    context.familyDiabetes &&
    isAffirmative(context.familyDiabetes) &&
    ["fasting_insulin", "hba1c", "fasting_glucose"].includes(key)
  ) {
    return "high";
  }

  if (domain.includes("Hormonal") && context.sex === "female") return "high";
  return index === 0 ? "high" : "medium";
}

function missingReason(reason: string, key: ClinicalBiomarkerKey, context: ClinicalProfileContext) {
  if (key === "apob" && context.familyHeartDisease && isAffirmative(context.familyHeartDisease)) {
    return `${reason} Family heart-disease context makes ApoB especially high-yield.`;
  }

  if (key === "fasting_insulin" && context.familyDiabetes && isAffirmative(context.familyDiabetes)) {
    return `${reason} Family diabetes context makes insulin response especially high-yield.`;
  }

  return reason;
}

function profileContextLabel(context: ClinicalProfileContext) {
  const parts = [
    context.age ? `age ${context.age}` : null,
    context.sex && context.sex !== "unknown" ? `${context.sex} sex context` : null,
    context.familyHeartDisease && isAffirmative(context.familyHeartDisease)
      ? "family cardiovascular history"
      : null,
    context.familyDiabetes && isAffirmative(context.familyDiabetes)
      ? "family diabetes history"
      : null,
  ].filter(Boolean);

  return parts.join(", ");
}

function compactProfileContext(context: ClinicalProfileContext) {
  return Object.fromEntries(
    Object.entries(context).filter(([, value]) => value != null && value !== "")
  );
}

function normalizeSex(value: unknown): ClinicalProfileContext["sex"] {
  const normalized = safeString(value)?.toLowerCase();
  if (!normalized) return "unknown";
  if (["male", "man", "m"].includes(normalized)) return "male";
  if (["female", "woman", "f"].includes(normalized)) return "female";
  return "unknown";
}

function safeNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && value !== "" && value != null ? numeric : undefined;
}

function safeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isAffirmative(value: string) {
  return /yes|true|positive|present|family|father|mother|sibling|brother|sister/i.test(value);
}

function round(value: number) {
  return Number(value.toFixed(value >= 100 ? 0 : 1));
}

function isMissingTable(error: { message?: string; code?: string }) {
  return (
    error.code === "PGRST205" ||
    error.message?.includes("lab_biomarkers") ||
    error.message?.includes("clinical_insights") ||
    error.message?.includes("schema cache")
  );
}
