/**
 * Aeonvera — Biological Age Engine (V2)
 * --------------------------------------
 * Clinical-grade biological age estimation.
 *
 * Uses a weighted multi-domain scoring model
 * inspired by PhenoAge, Levine, and Klemera-Doubal methods.
 *
 * Domains:
 * - Cardiovascular
 * - Metabolic & Labs
 * - Body Composition
 * - Sleep & Recovery
 * - Exercise & Movement
 * - Nutrition & Lifestyle
 * - Mental & Cognitive
 * - Family History & Genetics
 *
 * Lab fields are optional — accuracy score reflects
 * how much data has been provided.
 */

export type AssessmentInput = {
  // ─── BASICS (required) ───
  age: number;
  sex: string;
  height_cm: number;
  weight_kg: number;

  // ─── CARDIOVASCULAR (optional) ───
  resting_hr?: number;
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  vo2_max?: number;
  hrv?: number;

  // ─── METABOLIC & LABS (optional) ───
  fasting_glucose?: number;
  hba1c?: number;
  total_cholesterol?: number;
  ldl?: number;
  hdl?: number;
  triglycerides?: number;
  fasting_insulin?: number;
  hscrp?: number;
  albumin?: number;
  creatinine?: number;
  lymphocyte_pct?: number;
  mean_cell_volume?: number;
  red_cell_distribution_width?: number;
  alkaline_phosphatase?: number;
  white_blood_cell_count?: number;

  // ─── BODY COMPOSITION (optional) ───
  body_fat_pct?: number;
  waist_cm?: number;

  // ─── SLEEP & RECOVERY (required) ───
  sleep_hours: number;
  sleep_quality: number;
  recovery_quality?: number;

  // ─── EXERCISE (required) ───
  exercise_days: number;
  strength_training: boolean;

  // ─── NUTRITION & LIFESTYLE (required) ───
  diet_type: string;
  alcohol_use: string;
  smoking: string;
  water_intake?: string;
  caffeine_intake?: string;
  fasting_type?: string;
  supplements?: string;
  sunlight_hours?: string;
  cold_exposure?: string;
  screen_time_before_bed?: string;

  // ─── MENTAL & COGNITIVE (optional) ───
  stress_level: number;
  anxiety_level?: number;
  cognitive_score?: number;
  social_connection?: number;
  purpose_score?: number;

  // ─── HORMONES (optional) ───
  testosterone?: number;
  cortisol?: number;

  // ─── FAMILY HISTORY (optional) ───
  family_heart_disease?: string;
  family_cancer?: string;
  family_diabetes?: string;
  family_longevity?: string;

  // ─── GOAL ───
  primary_goal: string;
};

export type BiologicalAgeFactor = {
  domain: string;
  impact: number;
  label: string;
  status: "positive" | "neutral" | "negative";
  dataQuality: "measured" | "estimated";
};

export type BiologicalAgeResult = {
  chronologicalAge: number;
  biologicalAge: number;
  ageDelta: number;
  score: number;
  accuracyScore: number;
  category: "excellent" | "good" | "average" | "poor";
  clinicalAge?: number;
  clinicalAgeDelta?: number;
  clinicalModel?: "phenoage_lite";
  clinicalCompleteness?: number;
  factors: BiologicalAgeFactor[];
  summary: string;
  missingDataPoints: string[];
};

/**
 * =========================
 * DOMAIN WEIGHTS
 * Higher weight = more influence on biological age
 * =========================
 */
const DOMAIN_WEIGHTS = {
  cardiovascular: 0.20,
  metabolic: 0.20,
  bodyComposition: 0.10,
  sleep: 0.15,
  exercise: 0.15,
  lifestyle: 0.10,
  mental: 0.05,
  family: 0.05,
};

/**
 * =========================
 * MAIN ENTRY
 * =========================
 */
export function computeBiologicalAge(
  input: AssessmentInput
): BiologicalAgeResult {
  const factors: BiologicalAgeFactor[] = [];
  const missingDataPoints: string[] = [];
  let weightedDelta = 0;
  let totalWeight = 0;

  /**
   * ─── CARDIOVASCULAR ───
   */
  const cardio = computeCardiovascular(input, missingDataPoints);
  factors.push(...cardio.factors);
  weightedDelta += cardio.delta * DOMAIN_WEIGHTS.cardiovascular;
  totalWeight += DOMAIN_WEIGHTS.cardiovascular;

  /**
   * ─── METABOLIC & LABS ───
   */
  const metabolic = computeMetabolic(input, missingDataPoints);
  factors.push(...metabolic.factors);
  weightedDelta += metabolic.delta * DOMAIN_WEIGHTS.metabolic;
  totalWeight += DOMAIN_WEIGHTS.metabolic;

  /**
   * ─── CLINICAL BIOMARKER AGE ───
   * PhenoAge-inspired lab layer. It only affects the final estimate when
   * enough of the clinical panel is available.
   */
  const clinical = computeClinicalBiomarkerAge(input, missingDataPoints);
  if (clinical) {
    factors.push(...clinical.factors);
  }

  /**
   * ─── BODY COMPOSITION ───
   */
  const body = computeBodyComposition(input, missingDataPoints);
  factors.push(...body.factors);
  weightedDelta += body.delta * DOMAIN_WEIGHTS.bodyComposition;
  totalWeight += DOMAIN_WEIGHTS.bodyComposition;

  /**
   * ─── SLEEP & RECOVERY ───
   */
  const sleep = computeSleep(input, missingDataPoints);
  factors.push(...sleep.factors);
  weightedDelta += sleep.delta * DOMAIN_WEIGHTS.sleep;
  totalWeight += DOMAIN_WEIGHTS.sleep;

  /**
   * ─── EXERCISE ───
   */
  const exercise = computeExercise(input);
  factors.push(...exercise.factors);
  weightedDelta += exercise.delta * DOMAIN_WEIGHTS.exercise;
  totalWeight += DOMAIN_WEIGHTS.exercise;

  /**
   * ─── LIFESTYLE ───
   */
  const lifestyle = computeLifestyle(input);
  factors.push(...lifestyle.factors);
  weightedDelta += lifestyle.delta * DOMAIN_WEIGHTS.lifestyle;
  totalWeight += DOMAIN_WEIGHTS.lifestyle;

  /**
   * ─── MENTAL & COGNITIVE ───
   */
  const mental = computeMental(input, missingDataPoints);
  factors.push(...mental.factors);
  weightedDelta += mental.delta * DOMAIN_WEIGHTS.mental;
  totalWeight += DOMAIN_WEIGHTS.mental;

  /**
   * ─── FAMILY HISTORY ───
   */
  const family = computeFamily(input, missingDataPoints);
  factors.push(...family.factors);
  weightedDelta += family.delta * DOMAIN_WEIGHTS.family;
  totalWeight += DOMAIN_WEIGHTS.family;

  /**
   * ─── FINAL COMPUTATION ───
   */
  const lifestyleAgeDelta = totalWeight > 0
    ? weightedDelta / totalWeight
    : weightedDelta;
  const ageDelta = clinical
    ? blendAgeDeltas(lifestyleAgeDelta, clinical.delta, clinical.completeness)
    : lifestyleAgeDelta;

  const biologicalAge = Math.max(
    18,
    Math.round(input.age + ageDelta)
  );

  const score = computeOverallScore(ageDelta);
  const category = classifyCategory(ageDelta);
  const accuracyScore = computeAccuracyScore(input);
  const summary = buildSummary(
    input.age,
    biologicalAge,
    ageDelta,
    category,
    accuracyScore
  );

  return {
    chronologicalAge: input.age,
    biologicalAge,
    ageDelta: Number(ageDelta.toFixed(1)),
    score,
    accuracyScore,
    category,
    clinicalAge: clinical?.clinicalAge,
    clinicalAgeDelta: clinical?.delta,
    clinicalModel: clinical ? "phenoage_lite" : undefined,
    clinicalCompleteness: clinical?.completeness,
    factors: factors
      .filter((f) => f.impact !== 0)
      .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)),
    summary,
    missingDataPoints,
  };
}

/**
 * =========================
 * CARDIOVASCULAR DOMAIN
 * =========================
 */
function computeCardiovascular(
  input: AssessmentInput,
  missing: string[]
): { delta: number; factors: BiologicalAgeFactor[] } {
  const factors: BiologicalAgeFactor[] = [];
  let delta = 0;
  let measured = 0;

  // RESTING HEART RATE
  if (input.resting_hr != null) {
    measured++;
    let impact = 0;
    if (input.resting_hr < 50) impact = -3.0;
    else if (input.resting_hr <= 60) impact = -2.0;
    else if (input.resting_hr <= 70) impact = -0.5;
    else if (input.resting_hr <= 80) impact = 1.0;
    else if (input.resting_hr <= 90) impact = 2.5;
    else impact = 4.0;

    delta += impact;
    factors.push({
      domain: "Resting Heart Rate",
      impact: Number(impact.toFixed(1)),
      label:
        impact < 0
          ? `Excellent RHR of ${input.resting_hr} bpm`
          : impact > 1
          ? `Elevated RHR of ${input.resting_hr} bpm is aging the cardiovascular system`
          : `RHR of ${input.resting_hr} bpm is within normal range`,
      status: impact < -0.5 ? "positive" : impact > 1 ? "negative" : "neutral",
      dataQuality: "measured",
    });
  } else {
    missing.push("Resting heart rate");
  }

  // BLOOD PRESSURE
  if (input.blood_pressure_systolic != null && input.blood_pressure_diastolic != null) {
    measured++;
    let impact = 0;
    const sys = input.blood_pressure_systolic;
    const dia = input.blood_pressure_diastolic;

    if (sys < 120 && dia < 80) impact = -2.0;
    else if (sys < 130 && dia < 80) impact = 0;
    else if (sys < 140 || dia < 90) impact = 2.0;
    else if (sys < 160 || dia < 100) impact = 4.0;
    else impact = 7.0;

    delta += impact;
    factors.push({
      domain: "Blood Pressure",
      impact: Number(impact.toFixed(1)),
      label:
        impact < 0
          ? `Optimal blood pressure (${sys}/${dia})`
          : impact > 2
          ? `Elevated blood pressure (${sys}/${dia}) is a significant aging factor`
          : `Blood pressure (${sys}/${dia}) is acceptable`,
      status: impact < 0 ? "positive" : impact > 2 ? "negative" : "neutral",
      dataQuality: "measured",
    });
  } else {
    missing.push("Blood pressure");
  }

  // VO2 MAX
  if (input.vo2_max != null) {
    measured++;
    let impact = 0;
    const vo2 = input.vo2_max;
    const isMale = input.sex?.toLowerCase() === "male";

    if (isMale) {
      if (vo2 >= 55) impact = -4.0;
      else if (vo2 >= 45) impact = -2.0;
      else if (vo2 >= 35) impact = 0;
      else if (vo2 >= 25) impact = 2.5;
      else impact = 5.0;
    } else {
      if (vo2 >= 50) impact = -4.0;
      else if (vo2 >= 40) impact = -2.0;
      else if (vo2 >= 30) impact = 0;
      else if (vo2 >= 20) impact = 2.5;
      else impact = 5.0;
    }

    delta += impact;
    factors.push({
      domain: "VO2 Max",
      impact: Number(impact.toFixed(1)),
      label:
        impact < -1
          ? `Superior cardiorespiratory fitness (VO2 ${vo2})`
          : impact > 2
          ? `Low VO2 max (${vo2}) indicates poor cardiovascular fitness`
          : `VO2 max (${vo2}) is within average range`,
      status: impact < -0.5 ? "positive" : impact > 2 ? "negative" : "neutral",
      dataQuality: "measured",
    });
  } else {
    missing.push("VO2 max");
  }

  // HRV
  if (input.hrv != null) {
    measured++;
    let impact = 0;
    if (input.hrv >= 70) impact = -3.0;
    else if (input.hrv >= 50) impact = -1.5;
    else if (input.hrv >= 35) impact = 0;
    else if (input.hrv >= 20) impact = 1.5;
    else impact = 3.5;

    delta += impact;
    factors.push({
      domain: "Heart Rate Variability",
      impact: Number(impact.toFixed(1)),
      label:
        impact < 0
          ? `Strong HRV of ${input.hrv}ms indicates excellent autonomic health`
          : impact > 1
          ? `Low HRV of ${input.hrv}ms reflects physiological stress`
          : `HRV of ${input.hrv}ms is within normal range`,
      status: impact < -0.5 ? "positive" : impact > 1 ? "negative" : "neutral",
      dataQuality: "measured",
    });
  } else {
    missing.push("Heart rate variability (HRV)");
  }

  // Normalize delta by measured fields
  const normalizedDelta = measured > 0 ? delta / Math.max(1, measured) * 2 : 0;

  return { delta: normalizedDelta, factors };
}

/**
 * =========================
 * METABOLIC DOMAIN
 * =========================
 */
function computeMetabolic(
  input: AssessmentInput,
  missing: string[]
): { delta: number; factors: BiologicalAgeFactor[] } {
  const factors: BiologicalAgeFactor[] = [];
  let delta = 0;
  let measured = 0;

  // FASTING GLUCOSE
  if (input.fasting_glucose != null) {
    measured++;
    let impact = 0;
    const g = input.fasting_glucose;
    if (g < 85) impact = -2.0;
    else if (g <= 95) impact = -0.5;
    else if (g <= 100) impact = 0.5;
    else if (g <= 110) impact = 2.0;
    else if (g <= 125) impact = 4.0;
    else impact = 7.0;

    delta += impact;
    factors.push({
      domain: "Fasting Glucose",
      impact: Number(impact.toFixed(1)),
      label:
        impact < 0
          ? `Excellent fasting glucose (${g} mg/dL)`
          : impact > 2
          ? `Elevated fasting glucose (${g} mg/dL) — metabolic aging risk`
          : `Fasting glucose (${g} mg/dL) within acceptable range`,
      status: impact < 0 ? "positive" : impact > 2 ? "negative" : "neutral",
      dataQuality: "measured",
    });
  } else {
    missing.push("Fasting glucose");
  }

  // HBA1C
  if (input.hba1c != null) {
    measured++;
    let impact = 0;
    const h = input.hba1c;
    if (h < 5.0) impact = -2.0;
    else if (h <= 5.4) impact = -1.0;
    else if (h <= 5.7) impact = 0;
    else if (h <= 6.0) impact = 2.0;
    else if (h <= 6.4) impact = 4.0;
    else impact = 8.0;

    delta += impact;
    factors.push({
      domain: "HbA1c",
      impact: Number(impact.toFixed(1)),
      label:
        impact < 0
          ? `Optimal HbA1c (${h}%) — excellent long-term glucose control`
          : impact > 2
          ? `Elevated HbA1c (${h}%) indicates metabolic dysfunction`
          : `HbA1c (${h}%) is within normal range`,
      status: impact < 0 ? "positive" : impact > 2 ? "negative" : "neutral",
      dataQuality: "measured",
    });
  } else {
    missing.push("HbA1c");
  }

  // LDL
  if (input.ldl != null) {
    measured++;
    let impact = 0;
    const l = input.ldl;
    if (l < 70) impact = -1.5;
    else if (l < 100) impact = -0.5;
    else if (l < 130) impact = 0.5;
    else if (l < 160) impact = 2.0;
    else impact = 4.0;

    delta += impact;
    factors.push({
      domain: "LDL Cholesterol",
      impact: Number(impact.toFixed(1)),
      label:
        impact < 0
          ? `Optimal LDL (${l} mg/dL)`
          : impact > 1.5
          ? `Elevated LDL (${l} mg/dL) — cardiovascular aging risk`
          : `LDL (${l} mg/dL) is within acceptable range`,
      status: impact < 0 ? "positive" : impact > 1.5 ? "negative" : "neutral",
      dataQuality: "measured",
    });
  } else {
    missing.push("LDL cholesterol");
  }

  // HDL
  if (input.hdl != null) {
    measured++;
    let impact = 0;
    const h = input.hdl;
    if (h >= 70) impact = -2.0;
    else if (h >= 60) impact = -1.0;
    else if (h >= 40) impact = 0;
    else if (h >= 30) impact = 2.0;
    else impact = 4.0;

    delta += impact;
    factors.push({
      domain: "HDL Cholesterol",
      impact: Number(impact.toFixed(1)),
      label:
        impact < 0
          ? `Excellent HDL (${h} mg/dL) — protective cardiovascular factor`
          : impact > 1.5
          ? `Low HDL (${h} mg/dL) — reduced cardiovascular protection`
          : `HDL (${h} mg/dL) is within normal range`,
      status: impact < 0 ? "positive" : impact > 1.5 ? "negative" : "neutral",
      dataQuality: "measured",
    });
  } else {
    missing.push("HDL cholesterol");
  }

  // TRIGLYCERIDES
  if (input.triglycerides != null) {
    measured++;
    let impact = 0;
    const t = input.triglycerides;
    if (t < 75) impact = -1.5;
    else if (t < 100) impact = -0.5;
    else if (t < 150) impact = 0.5;
    else if (t < 200) impact = 2.0;
    else impact = 4.0;

    delta += impact;
    factors.push({
      domain: "Triglycerides",
      impact: Number(impact.toFixed(1)),
      label:
        impact < 0
          ? `Optimal triglycerides (${t} mg/dL)`
          : impact > 1.5
          ? `Elevated triglycerides (${t} mg/dL) — metabolic risk`
          : `Triglycerides (${t} mg/dL) within acceptable range`,
      status: impact < 0 ? "positive" : impact > 1.5 ? "negative" : "neutral",
      dataQuality: "measured",
    });
  } else {
    missing.push("Triglycerides");
  }

  // hsCRP (INFLAMMATION)
  if (input.hscrp != null) {
    measured++;
    let impact = 0;
    const c = input.hscrp;
    if (c < 0.5) impact = -2.5;
    else if (c < 1.0) impact = -1.0;
    else if (c < 2.0) impact = 0.5;
    else if (c < 3.0) impact = 2.0;
    else if (c < 10.0) impact = 5.0;
    else impact = 8.0;

    delta += impact;
    factors.push({
      domain: "Inflammation (hsCRP)",
      impact: Number(impact.toFixed(1)),
      label:
        impact < 0
          ? `Very low inflammation (hsCRP ${c} mg/L) — excellent longevity signal`
          : impact > 2
          ? `Elevated inflammation (hsCRP ${c} mg/L) — chronic disease risk`
          : `Inflammation (hsCRP ${c} mg/L) is within normal range`,
      status: impact < 0 ? "positive" : impact > 2 ? "negative" : "neutral",
      dataQuality: "measured",
    });
  } else {
    missing.push("hsCRP (inflammation marker)");
  }

  // FASTING INSULIN
  if (input.fasting_insulin != null) {
    measured++;
    let impact = 0;
    const fi = input.fasting_insulin;
    if (fi < 5) impact = -2.0;
    else if (fi < 8) impact = -0.5;
    else if (fi < 12) impact = 0.5;
    else if (fi < 20) impact = 2.5;
    else impact = 5.0;

    delta += impact;
    factors.push({
      domain: "Fasting Insulin",
      impact: Number(impact.toFixed(1)),
      label:
        impact < 0
          ? `Excellent insulin sensitivity (${fi} μIU/mL)`
          : impact > 2
          ? `Insulin resistance detected (${fi} μIU/mL) — metabolic aging`
          : `Fasting insulin (${fi} μIU/mL) within normal range`,
      status: impact < 0 ? "positive" : impact > 2 ? "negative" : "neutral",
      dataQuality: "measured",
    });
  } else {
    missing.push("Fasting insulin");
  }

  const normalizedDelta = measured > 0
    ? delta / Math.max(1, measured) * 2.5
    : 0;

  return { delta: normalizedDelta, factors };
}

/**
 * =========================
 * BODY COMPOSITION DOMAIN
 * =========================
 */
function computeBodyComposition(
  input: AssessmentInput,
  missing: string[]
): { delta: number; factors: BiologicalAgeFactor[] } {
  const factors: BiologicalAgeFactor[] = [];
  let delta = 0;

  // BMI (always computed)
  const heightM = input.height_cm / 100;
  const bmi = input.weight_kg / (heightM * heightM);
  let bmiImpact = 0;

  if (bmi >= 18.5 && bmi <= 22.9) bmiImpact = -1.5;
  else if (bmi <= 24.9) bmiImpact = -0.5;
  else if (bmi <= 27.5) bmiImpact = 1.0;
  else if (bmi <= 29.9) bmiImpact = 2.0;
  else if (bmi <= 34.9) bmiImpact = 3.5;
  else bmiImpact = 6.0;

  delta += bmiImpact;
  factors.push({
    domain: "BMI",
    impact: Number(bmiImpact.toFixed(1)),
    label:
      bmiImpact < 0
        ? `Optimal BMI (${bmi.toFixed(1)}) supporting longevity`
        : bmiImpact > 2
        ? `Elevated BMI (${bmi.toFixed(1)}) is accelerating biological aging`
        : `BMI (${bmi.toFixed(1)}) has minor impact`,
    status:
      bmiImpact < 0 ? "positive" : bmiImpact > 2 ? "negative" : "neutral",
    dataQuality: "measured",
  });

  // BODY FAT %
  if (input.body_fat_pct != null) {
    let impact = 0;
    const bf = input.body_fat_pct;
    const isMale = input.sex?.toLowerCase() === "male";

    if (isMale) {
      if (bf < 12) impact = -2.0;
      else if (bf <= 17) impact = -1.0;
      else if (bf <= 22) impact = 0;
      else if (bf <= 27) impact = 1.5;
      else impact = 3.5;
    } else {
      if (bf < 18) impact = -2.0;
      else if (bf <= 24) impact = -1.0;
      else if (bf <= 30) impact = 0;
      else if (bf <= 35) impact = 1.5;
      else impact = 3.5;
    }

    delta += impact;
    factors.push({
      domain: "Body Fat %",
      impact: Number(impact.toFixed(1)),
      label:
        impact < 0
          ? `Excellent body composition (${bf}% body fat)`
          : impact > 1.5
          ? `High body fat (${bf}%) is a significant aging factor`
          : `Body fat (${bf}%) within acceptable range`,
      status: impact < 0 ? "positive" : impact > 1.5 ? "negative" : "neutral",
      dataQuality: "measured",
    });
  } else {
    missing.push("Body fat percentage");
  }

  // WAIST CIRCUMFERENCE
  if (input.waist_cm != null) {
    let impact = 0;
    const w = input.waist_cm;
    const isMale = input.sex?.toLowerCase() === "male";

    if (isMale) {
      if (w < 80) impact = -1.5;
      else if (w <= 90) impact = 0;
      else if (w <= 100) impact = 2.0;
      else impact = 4.0;
    } else {
      if (w < 70) impact = -1.5;
      else if (w <= 80) impact = 0;
      else if (w <= 90) impact = 2.0;
      else impact = 4.0;
    }

    delta += impact;
    factors.push({
      domain: "Waist Circumference",
      impact: Number(impact.toFixed(1)),
      label:
        impact < 0
          ? `Healthy waist circumference (${w}cm) — low visceral fat`
          : impact > 1.5
          ? `Elevated waist (${w}cm) indicates visceral fat accumulation`
          : `Waist circumference (${w}cm) within normal range`,
      status: impact < 0 ? "positive" : impact > 1.5 ? "negative" : "neutral",
      dataQuality: "measured",
    });
  } else {
    missing.push("Waist circumference");
  }

  return { delta, factors };
}

/**
 * =========================
 * CLINICAL BIOMARKER AGE
 * PhenoAge-inspired layer using the published biomarker set. This is a
 * product estimate, not a medical diagnostic model.
 * =========================
 */
function computeClinicalBiomarkerAge(
  input: AssessmentInput,
  missing: string[]
): {
  clinicalAge: number;
  delta: number;
  completeness: number;
  factors: BiologicalAgeFactor[];
} | null {
  const clinicalFields: Array<{
    key: keyof AssessmentInput;
    label: string;
  }> = [
    { key: "albumin", label: "Albumin" },
    { key: "creatinine", label: "Creatinine" },
    { key: "fasting_glucose", label: "Fasting glucose" },
    { key: "hscrp", label: "C-reactive protein / hsCRP" },
    { key: "lymphocyte_pct", label: "Lymphocyte %" },
    { key: "mean_cell_volume", label: "Mean cell volume" },
    { key: "red_cell_distribution_width", label: "Red cell distribution width" },
    { key: "alkaline_phosphatase", label: "Alkaline phosphatase" },
    { key: "white_blood_cell_count", label: "White blood cell count" },
  ];
  const present = clinicalFields.filter(({ key }) => input[key] != null);
  const completeness = Math.round((present.length / clinicalFields.length) * 100);

  clinicalFields
    .filter(({ key }) => input[key] == null)
    .forEach(({ label }) => missing.push(label));

  if (present.length < 6) return null;

  const albumin = normalizeAlbumin(input.albumin ?? 4.4);
  const creatinine = normalizeCreatinine(input.creatinine ?? 0.9);
  const glucose = normalizeGlucose(input.fasting_glucose ?? 90);
  const crp = normalizeCrp(input.hscrp ?? 0.8);
  const lymphocyte = input.lymphocyte_pct ?? 30;
  const mcv = input.mean_cell_volume ?? 90;
  const rdw = input.red_cell_distribution_width ?? 13;
  const alkPhos = input.alkaline_phosphatase ?? 70;
  const wbc = input.white_blood_cell_count ?? 6;

  const xb =
    -19.907 -
    0.0336 * albumin +
    0.0095 * creatinine +
    0.1953 * glucose +
    0.0954 * Math.log(Math.max(0.01, crp)) -
    0.012 * lymphocyte +
    0.0268 * mcv +
    0.3306 * rdw +
    0.0019 * alkPhos +
    0.0554 * wbc +
    0.0804 * input.age;

  const mortalityScore =
    1 - Math.exp((-Math.exp(xb) * (Math.exp(120 * 0.0076927) - 1)) / 0.0076927);
  const boundedMortality = Math.max(0.000001, Math.min(0.999999, mortalityScore));
  const clinicalAge =
    141.50225 + Math.log(-0.00553 * Math.log(1 - boundedMortality)) / 0.09165;
  const boundedAge = Math.max(18, Math.min(120, clinicalAge));
  const delta = Number((boundedAge - input.age).toFixed(1));

  return {
    clinicalAge: Math.round(boundedAge),
    delta,
    completeness,
    factors: [
      {
        domain: "Clinical Biomarker Age",
        impact: delta,
        label:
          delta < -1
            ? `Clinical biomarkers estimate ${Math.abs(delta).toFixed(1)} years below chronological age`
            : delta > 1
            ? `Clinical biomarkers estimate ${delta.toFixed(1)} years above chronological age`
            : "Clinical biomarkers align closely with chronological age",
        status: delta < -1 ? "positive" : delta > 1 ? "negative" : "neutral",
        dataQuality: present.length === clinicalFields.length ? "measured" : "estimated",
      },
    ],
  };
}

/**
 * =========================
 * SLEEP & RECOVERY DOMAIN
 * =========================
 */
function computeSleep(
  input: AssessmentInput,
  missing: string[]
): { delta: number; factors: BiologicalAgeFactor[] } {
  const factors: BiologicalAgeFactor[] = [];
  let delta = 0;

  // SLEEP HOURS
  let sleepImpact = 0;
  if (input.sleep_hours >= 7 && input.sleep_hours <= 9) sleepImpact = -2.0;
  else if (input.sleep_hours >= 6.5) sleepImpact = -0.5;
  else if (input.sleep_hours >= 6) sleepImpact = 1.0;
  else if (input.sleep_hours >= 5) sleepImpact = 2.5;
  else sleepImpact = 4.5;

  delta += sleepImpact;
  factors.push({
    domain: "Sleep Duration",
    impact: Number(sleepImpact.toFixed(1)),
    label:
      sleepImpact < 0
        ? `Optimal sleep duration (${input.sleep_hours}hrs) supporting cellular repair`
        : sleepImpact > 1
        ? `Insufficient sleep (${input.sleep_hours}hrs) is accelerating biological aging`
        : `Sleep duration (${input.sleep_hours}hrs) is acceptable`,
    status:
      sleepImpact < -0.5
        ? "positive"
        : sleepImpact > 1
        ? "negative"
        : "neutral",
    dataQuality: "measured",
  });

  // SLEEP QUALITY
  let qualityImpact = 0;
  if (input.sleep_quality >= 9) qualityImpact = -2.0;
  else if (input.sleep_quality >= 7) qualityImpact = -1.0;
  else if (input.sleep_quality >= 5) qualityImpact = 0.5;
  else if (input.sleep_quality >= 3) qualityImpact = 2.0;
  else qualityImpact = 3.5;

  delta += qualityImpact;
  factors.push({
    domain: "Sleep Quality",
    impact: Number(qualityImpact.toFixed(1)),
    label:
      qualityImpact < 0
        ? `Excellent sleep quality (${input.sleep_quality}/10)`
        : qualityImpact > 1
        ? `Poor sleep quality (${input.sleep_quality}/10) impairs recovery`
        : `Sleep quality (${input.sleep_quality}/10) is adequate`,
    status:
      qualityImpact < -0.5
        ? "positive"
        : qualityImpact > 1
        ? "negative"
        : "neutral",
    dataQuality: "measured",
  });

  // SCREEN TIME BEFORE BED
  if (input.screen_time_before_bed) {
    const s = input.screen_time_before_bed.toLowerCase();
    let impact = 0;
    if (s.includes("none") || s === "0") impact = -0.5;
    else if (s.includes("30") || s.includes("less")) impact = 0;
    else if (s.includes("1 hour") || s.includes("60")) impact = 0.5;
    else if (s.includes("2") || s.includes("more")) impact = 1.5;

    delta += impact;
    if (Math.abs(impact) > 0) {
      factors.push({
        domain: "Screen Time Before Bed",
        impact: Number(impact.toFixed(1)),
        label:
          impact <= 0
            ? "Low screen exposure before bed supports melatonin production"
            : "High screen time before bed disrupts circadian rhythm",
        status: impact <= 0 ? "positive" : "negative",
        dataQuality: "measured",
      });
    }
  }

  // RECOVERY QUALITY
  if (input.recovery_quality != null) {
    let impact = 0;
    if (input.recovery_quality >= 8) impact = -1.5;
    else if (input.recovery_quality >= 6) impact = -0.5;
    else if (input.recovery_quality >= 4) impact = 0.5;
    else impact = 2.0;

    delta += impact;
    factors.push({
      domain: "Recovery Quality",
      impact: Number(impact.toFixed(1)),
      label:
        impact < 0
          ? `Strong recovery capacity (${input.recovery_quality}/10)`
          : `Poor recovery (${input.recovery_quality}/10) is impairing repair`,
      status: impact < 0 ? "positive" : impact > 1 ? "negative" : "neutral",
      dataQuality: "measured",
    });
  } else {
    missing.push("Recovery quality score");
  }

  return { delta, factors };
}

/**
 * =========================
 * EXERCISE DOMAIN
 * =========================
 */
function computeExercise(input: AssessmentInput): { delta: number; factors: BiologicalAgeFactor[] } {
  const factors: BiologicalAgeFactor[] = [];
  let delta = 0;

  // EXERCISE FREQUENCY
  let exerciseImpact = 0;
  if (input.exercise_days >= 6) exerciseImpact = -3.5;
  else if (input.exercise_days >= 4) exerciseImpact = -2.5;
  else if (input.exercise_days >= 3) exerciseImpact = -1.0;
  else if (input.exercise_days >= 1) exerciseImpact = 0.5;
  else exerciseImpact = 4.0;

  delta += exerciseImpact;
  factors.push({
    domain: "Exercise Frequency",
    impact: Number(exerciseImpact.toFixed(1)),
    label:
      exerciseImpact < -1
        ? `High exercise frequency (${input.exercise_days}x/week) is a major longevity driver`
        : exerciseImpact > 1
        ? `Low exercise (${input.exercise_days}x/week) is accelerating biological aging`
        : `Exercise frequency (${input.exercise_days}x/week) is adequate`,
    status:
      exerciseImpact < -0.5
        ? "positive"
        : exerciseImpact > 1
        ? "negative"
        : "neutral",
    dataQuality: "measured",
  });

  // STRENGTH TRAINING
  if (input.strength_training) {
    const impact = -2.5;
    delta += impact;
    factors.push({
      domain: "Strength Training",
      impact,
      label:
        "Resistance training is preserving muscle mass and metabolic rate",
      status: "positive",
      dataQuality: "measured",
    });
  } else {
    const impact = 1.5;
    delta += impact;
    factors.push({
      domain: "Strength Training",
      impact,
      label:
        "Absence of resistance training accelerates muscle loss and metabolic aging",
      status: "negative",
      dataQuality: "measured",
    });
  }

  return { delta, factors };
}

/**
 * =========================
 * LIFESTYLE DOMAIN
 * =========================
 */
function computeLifestyle(input: AssessmentInput): { delta: number; factors: BiologicalAgeFactor[] } {
  const factors: BiologicalAgeFactor[] = [];
  let delta = 0;

  // SMOKING
  const smokingImpact = computeSmokingImpact(input.smoking);
  delta += smokingImpact.impact;
  factors.push(smokingImpact);

  // ALCOHOL
  const alcoholImpact = computeAlcoholImpact(input.alcohol_use);
  delta += alcoholImpact.impact;
  factors.push(alcoholImpact);

  // DIET
  const dietImpact = computeDietImpact(input.diet_type);
  delta += dietImpact.impact;
  factors.push(dietImpact);

  // WATER INTAKE
  if (input.water_intake) {
    const w = input.water_intake.toLowerCase();
    let impact = 0;
    if (w.includes("3") || w.includes("more") || w.includes("optimal"))
      impact = -0.5;
    else if (w.includes("2")) impact = 0;
    else if (w.includes("1") || w.includes("less")) impact = 0.5;
    else if (w.includes("very low") || w.includes("rarely")) impact = 1.5;

    if (Math.abs(impact) > 0) {
      delta += impact;
      factors.push({
        domain: "Hydration",
        impact: Number(impact.toFixed(1)),
        label:
          impact <= 0
            ? "Adequate hydration supporting cellular function"
            : "Low hydration is impairing cellular processes",
        status: impact <= 0 ? "positive" : "negative",
        dataQuality: "measured",
      });
    }
  }

  // FASTING
  if (input.fasting_type) {
    const f = input.fasting_type.toLowerCase();
    let impact = 0;
    if (f.includes("none") || f === "no") impact = 0.5;
    else if (f.includes("16:8") || f.includes("intermittent")) impact = -1.5;
    else if (f.includes("5:2") || f.includes("24")) impact = -2.0;
    else if (f.includes("extended") || f.includes("multi-day")) impact = -2.5;

    if (Math.abs(impact) > 0) {
      delta += impact;
      factors.push({
        domain: "Fasting Protocol",
        impact: Number(impact.toFixed(1)),
        label:
          impact < 0
            ? "Intermittent fasting is activating cellular autophagy pathways"
            : "No fasting protocol — autophagy not being regularly activated",
        status: impact < 0 ? "positive" : "neutral",
        dataQuality: "measured",
      });
    }
  }

  // SUNLIGHT
  if (input.sunlight_hours) {
    const s = input.sunlight_hours.toLowerCase();
    let impact = 0;
    if (s.includes("none") || s.includes("rarely")) impact = 1.0;
    else if (s.includes("30") || s.includes("less than 1")) impact = 0;
    else if (s.includes("1") || s.includes("2")) impact = -0.5;
    else if (s.includes("3") || s.includes("more")) impact = -1.0;

    if (Math.abs(impact) > 0) {
      delta += impact;
      factors.push({
        domain: "Sunlight Exposure",
        impact: Number(impact.toFixed(1)),
        label:
          impact < 0
            ? "Regular sunlight exposure supporting vitamin D and circadian health"
            : "Minimal sunlight exposure may be impacting vitamin D and circadian rhythm",
        status: impact < 0 ? "positive" : "neutral",
        dataQuality: "measured",
      });
    }
  }

  // SUPPLEMENTS
  if (input.supplements) {
    const s = input.supplements.toLowerCase();
    let impact = 0;
    if (s.includes("none") || s === "no") impact = 0;
    else if (
      s.includes("nmn") ||
      s.includes("nad") ||
      s.includes("resveratrol") ||
      s.includes("rapamycin")
    ) impact = -2.0;
    else if (
      s.includes("omega") ||
      s.includes("vitamin d") ||
      s.includes("magnesium") ||
      s.includes("creatine")
    ) impact = -1.0;
    else impact = -0.5;

    if (impact < 0) {
      delta += impact;
      factors.push({
        domain: "Supplementation",
        impact: Number(impact.toFixed(1)),
        label: "Evidence-based supplementation stack supporting longevity pathways",
        status: "positive",
        dataQuality: "measured",
      });
    }
  }

  return { delta, factors };
}

/**
 * =========================
 * MENTAL & COGNITIVE DOMAIN
 * =========================
 */
function computeMental(
  input: AssessmentInput,
  missing: string[]
): { delta: number; factors: BiologicalAgeFactor[] } {
  const factors: BiologicalAgeFactor[] = [];
  let delta = 0;

  // STRESS
  let stressImpact = 0;
  if (input.stress_level <= 2) stressImpact = -2.0;
  else if (input.stress_level <= 4) stressImpact = -0.5;
  else if (input.stress_level <= 6) stressImpact = 0.5;
  else if (input.stress_level <= 8) stressImpact = 2.5;
  else stressImpact = 4.5;

  delta += stressImpact;
  factors.push({
    domain: "Chronic Stress",
    impact: Number(stressImpact.toFixed(1)),
    label:
      stressImpact < 0
        ? "Low stress levels are protecting telomere length and hormonal balance"
        : stressImpact > 2
        ? "High chronic stress is a major accelerant of biological aging"
        : "Moderate stress with manageable impact",
    status:
      stressImpact < -0.5
        ? "positive"
        : stressImpact > 1.5
        ? "negative"
        : "neutral",
    dataQuality: "measured",
  });

  // ANXIETY
  if (input.anxiety_level != null) {
    let impact = 0;
    if (input.anxiety_level <= 2) impact = -1.0;
    else if (input.anxiety_level <= 4) impact = 0;
    else if (input.anxiety_level <= 6) impact = 1.0;
    else if (input.anxiety_level <= 8) impact = 2.0;
    else impact = 3.5;

    delta += impact;
    factors.push({
      domain: "Anxiety Level",
      impact: Number(impact.toFixed(1)),
      label:
        impact < 0
          ? "Low anxiety — strong psychological resilience"
          : impact > 1
          ? "Elevated anxiety is contributing to chronic stress load"
          : "Anxiety within manageable range",
      status: impact < 0 ? "positive" : impact > 1 ? "negative" : "neutral",
      dataQuality: "measured",
    });
  } else {
    missing.push("Anxiety level");
  }

  // SOCIAL CONNECTION
  if (input.social_connection != null) {
    let impact = 0;
    if (input.social_connection >= 8) impact = -2.0;
    else if (input.social_connection >= 6) impact = -0.5;
    else if (input.social_connection >= 4) impact = 0.5;
    else impact = 2.5;

    delta += impact;
    factors.push({
      domain: "Social Connection",
      impact: Number(impact.toFixed(1)),
      label:
        impact < 0
          ? "Strong social bonds — one of the most powerful longevity factors"
          : impact > 1
          ? "Social isolation is a significant biological aging risk"
          : "Moderate social connection",
      status: impact < -0.5 ? "positive" : impact > 1 ? "negative" : "neutral",
      dataQuality: "measured",
    });
  } else {
    missing.push("Social connection score");
  }

  // PURPOSE
  if (input.purpose_score != null) {
    let impact = 0;
    if (input.purpose_score >= 8) impact = -1.5;
    else if (input.purpose_score >= 6) impact = -0.5;
    else if (input.purpose_score >= 4) impact = 0.5;
    else impact = 1.5;

    delta += impact;
    factors.push({
      domain: "Sense of Purpose",
      impact: Number(impact.toFixed(1)),
      label:
        impact < 0
          ? "Strong sense of purpose is linked to lower mortality risk"
          : "Low sense of purpose is associated with accelerated aging",
      status: impact < -0.5 ? "positive" : impact > 1 ? "negative" : "neutral",
      dataQuality: "measured",
    });
  } else {
    missing.push("Purpose / meaning score");
  }

  return { delta, factors };
}

/**
 * =========================
 * FAMILY HISTORY DOMAIN
 * =========================
 */
function computeFamily(
  input: AssessmentInput,
  missing: string[]
): { delta: number; factors: BiologicalAgeFactor[] } {
  const factors: BiologicalAgeFactor[] = [];
  let delta = 0;

  if (input.family_longevity) {
    const f = input.family_longevity.toLowerCase();
    let impact = 0;
    if (f.includes("90") || f.includes("100") || f.includes("centenarian"))
      impact = -3.0;
    else if (f.includes("85") || f.includes("long")) impact = -1.5;
    else if (f.includes("80")) impact = -0.5;
    else if (f.includes("70")) impact = 0.5;
    else if (f.includes("60") || f.includes("short")) impact = 2.0;

    if (Math.abs(impact) > 0) {
      delta += impact;
      factors.push({
        domain: "Family Longevity",
        impact: Number(impact.toFixed(1)),
        label:
          impact < 0
            ? "Strong family longevity history — favorable genetic foundation"
            : "Family history of early mortality — increased genetic risk",
        status: impact < 0 ? "positive" : impact > 1 ? "negative" : "neutral",
        dataQuality: "measured",
      });
    }
  } else {
    missing.push("Family longevity history");
  }

  if (input.family_heart_disease) {
    const f = input.family_heart_disease.toLowerCase();
    if (f === "yes" || f.includes("yes")) {
      delta += 1.5;
      factors.push({
        domain: "Family Heart Disease",
        impact: 1.5,
        label: "Family history of heart disease — elevated cardiovascular genetic risk",
        status: "negative",
        dataQuality: "measured",
      });
    }
  } else {
    missing.push("Family history — heart disease");
  }

  if (input.family_diabetes) {
    const f = input.family_diabetes.toLowerCase();
    if (f === "yes" || f.includes("yes")) {
      delta += 1.0;
      factors.push({
        domain: "Family Diabetes",
        impact: 1.0,
        label: "Family history of diabetes — elevated metabolic genetic risk",
        status: "negative",
        dataQuality: "measured",
      });
    }
  } else {
    missing.push("Family history — diabetes");
  }

  return { delta, factors };
}

/**
 * =========================
 * LIFESTYLE HELPERS
 * =========================
 */
function computeSmokingImpact(smoking: string): BiologicalAgeFactor {
  const s = smoking.toLowerCase();
  let impact = 0;

  if (s.includes("never") || s === "no") impact = -0.5;
  else if (s.includes("former") || s.includes("quit")) impact = 1.5;
  else if (s.includes("occasional") || s.includes("social")) impact = 3.5;
  else if (s.includes("daily") || s.includes("current") || s.includes("yes"))
    impact = 7.5;

  return {
    domain: "Smoking",
    impact: Number(impact.toFixed(1)),
    label:
      impact <= 0
        ? "Non-smoker — major longevity protective factor"
        : impact >= 5
        ? "Active smoking is the single largest accelerant of biological aging"
        : "Smoking history has moderate biological impact",
    status: impact <= 0 ? "positive" : impact >= 4 ? "negative" : "neutral",
    dataQuality: "measured",
  };
}

function computeAlcoholImpact(alcoholUse: string): BiologicalAgeFactor {
  const a = alcoholUse.toLowerCase();
  let impact = 0;

  if (a.includes("never") || a === "none" || a === "no") impact = -0.5;
  else if (a.includes("occasional") || a.includes("social") || a.includes("light"))
    impact = 0.5;
  else if (a.includes("moderate")) impact = 1.5;
  else if (a.includes("heavy") || a.includes("daily")) impact = 5.0;

  return {
    domain: "Alcohol",
    impact: Number(impact.toFixed(1)),
    label:
      impact <= 0
        ? "Alcohol-free — protecting liver, brain, and hormonal health"
        : impact >= 4
        ? "Heavy alcohol consumption is significantly aging the biological system"
        : `Moderate alcohol impact detected`,
    status: impact <= 0 ? "positive" : impact >= 3 ? "negative" : "neutral",
    dataQuality: "measured",
  };
}

function computeDietImpact(dietType: string): BiologicalAgeFactor {
  const d = dietType.toLowerCase();
  let impact = 0;

  if (d.includes("mediterranean")) impact = -2.5;
  else if (d.includes("whole food") || d.includes("plant")) impact = -2.0;
  else if (d.includes("paleo")) impact = -1.0;
  else if (d.includes("keto")) impact = -0.5;
  else if (d.includes("vegan") || d.includes("vegetarian")) impact = -1.0;
  else if (d.includes("standard") || d.includes("mixed")) impact = 0.5;
  else if (d.includes("processed") || d.includes("fast food")) impact = 3.5;
  else impact = 0.5;

  return {
    domain: "Nutrition",
    impact: Number(impact.toFixed(1)),
    label:
      impact < -1
        ? "Excellent diet quality — anti-inflammatory and longevity-promoting"
        : impact > 2
        ? "Poor diet quality is driving systemic inflammation and metabolic aging"
        : "Diet has moderate impact on biological age",
    status: impact < -0.5 ? "positive" : impact > 1.5 ? "negative" : "neutral",
    dataQuality: "measured",
  };
}

/**
 * =========================
 * ACCURACY SCORE
 * How complete is the data 0-100
 * =========================
 */
function computeAccuracyScore(input: AssessmentInput): number {
  const optionalFields: (keyof AssessmentInput)[] = [
    "resting_hr",
    "blood_pressure_systolic",
    "blood_pressure_diastolic",
    "vo2_max",
    "hrv",
    "fasting_glucose",
    "hba1c",
    "total_cholesterol",
    "ldl",
    "hdl",
    "triglycerides",
    "fasting_insulin",
    "hscrp",
    "albumin",
    "creatinine",
    "lymphocyte_pct",
    "mean_cell_volume",
    "red_cell_distribution_width",
    "alkaline_phosphatase",
    "white_blood_cell_count",
    "body_fat_pct",
    "waist_cm",
    "testosterone",
    "cortisol",
    "anxiety_level",
    "cognitive_score",
    "social_connection",
    "purpose_score",
    "recovery_quality",
    "water_intake",
    "fasting_type",
    "sunlight_hours",
    "supplements",
    "screen_time_before_bed",
    "family_heart_disease",
    "family_cancer",
    "family_diabetes",
    "family_longevity",
  ];

  const filled = optionalFields.filter((f) => {
    const val = input[f];
    return val != null && val !== "" && val !== undefined;
  }).length;

  const baseScore = 40;
  const optionalScore = Math.round((filled / optionalFields.length) * 60);
  return Math.min(100, baseScore + optionalScore);
}

/**
 * =========================
 * FINAL SCORING
 * =========================
 */
function computeOverallScore(ageDelta: number): number {
  const score = 50 - ageDelta * 4;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function blendAgeDeltas(
  lifestyleDelta: number,
  clinicalDelta: number,
  clinicalCompleteness: number
) {
  const clinicalWeight = Math.max(
    0.2,
    Math.min(0.5, clinicalCompleteness / 200)
  );
  const lifestyleWeight = 1 - clinicalWeight;
  return lifestyleDelta * lifestyleWeight + clinicalDelta * clinicalWeight;
}

function normalizeAlbumin(value: number) {
  return value <= 10 ? value * 10 : value;
}

function normalizeCreatinine(value: number) {
  return value < 20 ? value * 88.4 : value;
}

function normalizeGlucose(value: number) {
  return value > 25 ? value / 18 : value;
}

function normalizeCrp(value: number) {
  return value > 3 ? value / 10 : value;
}

function classifyCategory(
  ageDelta: number
): BiologicalAgeResult["category"] {
  if (ageDelta <= -5) return "excellent";
  if (ageDelta <= -1) return "good";
  if (ageDelta <= 4) return "average";
  return "poor";
}

function buildSummary(
  chronological: number,
  biological: number,
  delta: number,
  category: BiologicalAgeResult["category"],
  accuracyScore: number
): string {
  const direction = delta < 0 ? "younger" : "older";
  const years = Math.abs(delta).toFixed(1);

  const categoryText = {
    excellent:
      "Your biological system is performing exceptionally. You are on an elite longevity trajectory.",
    good: "Your biological system is in strong health with clear areas for further optimization.",
    average:
      "Your biological system shows meaningful optimization opportunities that can significantly reduce your biological age.",
    poor: "Your biological system requires targeted intervention. Significant improvements are achievable.",
  }[category];

  const accuracyNote =
    accuracyScore < 60
      ? ` Add lab results and biomarkers to improve accuracy to ${accuracyScore}%.`
      : "";

  return `At ${chronological} years old, your biological age is estimated at ${biological} — ${years} years ${direction} than your chronological age. ${categoryText}${accuracyNote}`;
}
