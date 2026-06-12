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

export type ClinicalRangeFlag = {
  action: string;
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
    action: "Use HDL together with triglycerides, ApoB, and insulin rather than treating it alone.",
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
  const latest = latestBiomarkers(rows);
  const rangeFlags = Array.from(latest.values())
    .map((row) => buildRangeFlag(row))
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
  const missingInputs = buildMissingInputs(latest);
  const riskTier = highestTier(rangeFlags.map((flag) => flag.tier));
  const confidence = computeConfidence(latest.size, missingInputs);
  const recommendedActions = buildRecommendedActions(rangeFlags, missingInputs);
  const followUpQuestions = buildFollowUpQuestions(rangeFlags, missingInputs);

  return {
    confidence,
    domains: signalMap.filter((domain) => domain.present.length).map((domain) => domain.domain),
    followUpQuestions,
    missingInputs,
    recommendedActions,
    riskTier,
    signalMap,
    summary: buildSummary({ confidence, missingInputs, rangeFlags, riskTier }),
    rangeFlags,
  };
}

export async function createClinicalInsightFromLabs({
  sourceQuestion = "Clinical lab import",
  supabase,
  userId,
}: {
  sourceQuestion?: string;
  supabase: SupabaseClient;
  userId: string;
}) {
  const { data, error } = await supabase
    .from("lab_biomarkers")
    .select("canonical_key,value,unit,raw_label,measured_at")
    .eq("user_id", userId)
    .order("measured_at", { ascending: false })
    .limit(160);

  if (error) {
    if (!isMissingTable(error)) {
      console.error("[Clinical Intelligence Lab Load Error]", error.message);
    }

    return null;
  }

  const intelligence = buildClinicalIntelligence((data || []) as ClinicalBiomarkerRow[]);
  if (!intelligence.rangeFlags.length && intelligence.confidence < 20) return null;

  const { error: insertError } = await supabase.from("clinical_insights").insert({
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
  row: ClinicalBiomarkerRow & { numericValue: number }
): ClinicalRangeFlag | null {
  const definition = MARKERS.find((marker) => marker.key === row.canonical_key);
  if (!definition) return null;

  const tier = classifyValue(row.numericValue, definition);
  const readableValue = `${round(row.numericValue)} ${definition.unit}`;

  return {
    action: definition.action,
    domain: definition.domain,
    key: row.canonical_key,
    label: definition.label,
    rationale: `${definition.label} is ${readableValue}. ${tierReason(tier)}`,
    tier,
    unit: definition.unit,
    value: round(row.numericValue),
  };
}

function classifyValue(value: number, definition: MarkerDefinition): ClinicalRiskTier {
  if (inRange(value, definition.urgent)) return "urgent";
  if (inRange(value, definition.clinicianReview)) return "clinician_review";
  if (inRange(value, definition.monitor)) return "monitor";
  if (inRange(value, definition.optimal)) return "optimize";

  if (definition.lowerIsBetter && definition.optimal?.[1] != null && value > definition.optimal[1]) {
    return "monitor";
  }

  return "monitor";
}

function buildMissingInputs(latest: Map<ClinicalBiomarkerKey, ClinicalBiomarkerRow>) {
  return DOMAIN_REQUIREMENTS.flatMap((requirement) =>
    requirement.keys
      .filter((key) => !latest.has(key))
      .slice(0, 3)
      .map((key, index) => ({
        domain: requirement.domain,
        key,
        label: readableKey(key),
        priority: index === 0 ? "high" : "medium",
        reason: requirement.reason,
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

function buildFollowUpQuestions(flags: ClinicalRangeFlag[], missingInputs: MissingClinicalInput[]) {
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

  return questions.slice(0, 5);
}

function buildSummary({
  confidence,
  missingInputs,
  rangeFlags,
  riskTier,
}: {
  confidence: number;
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

  return `Clinical intelligence is ${confidence}% confident. Risk tier: ${riskTier.replace("_", " ")}. ${flagText}. ${missingText}`;
}

function computeConfidence(markerCount: number, missingInputs: MissingClinicalInput[]) {
  const totalExpected = Array.from(new Set(DOMAIN_REQUIREMENTS.flatMap((domain) => domain.keys))).length;
  const coverage = markerCount / Math.max(1, totalExpected);
  const missingPenalty = Math.min(0.28, missingInputs.filter((input) => input.priority === "high").length * 0.035);
  return Math.max(10, Math.min(95, Math.round((coverage - missingPenalty) * 100)));
}

function normalizeValue(row: ClinicalBiomarkerRow) {
  const value = Number(row.value);
  const unit = row.unit?.toLowerCase() || "";

  if (!Number.isFinite(value)) return Number.NaN;
  if (row.canonical_key === "fasting_glucose" && unit.includes("mmol")) return value * 18.0182;
  if (["triglycerides", "hdl_cholesterol", "ldl_cholesterol", "total_cholesterol"].includes(row.canonical_key) && unit.includes("mmol")) {
    return value * (row.canonical_key === "triglycerides" ? 88.57 : 38.67);
  }
  if (row.canonical_key === "hscrp" && unit.includes("mg/dl")) return value * 10;
  if (row.canonical_key === "apob" && unit === "g/l") return value * 100;
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
