/**
 * Aeonvera — Canonical Health Metrics Schema (V1)
 * -----------------------------------------------
 * This defines the ONLY allowed metric names in the system.
 *
 * EVERYTHING from wearables, labs, biomarkers, etc.
 * MUST be normalized into this schema before entering health_metrics.
 */

export type CanonicalHealthMetric =
  | "sleep_hours"
  | "sleep_efficiency"
  | "sleep_debt"

  | "daily_steps"
  | "active_minutes"
  | "sedentary_hours"

  | "resting_hr"
  | "heart_rate_variability"
  | "vo2max"

  | "recovery_score"
  | "strain_score"

  | "weight_kg"
  | "body_fat_pct"
  | "bmi"

  | "calories_burned"
  | "calories_intake"
  | "protein_intake"

  | "blood_glucose"
  | "hba1c"
  | "ldl_cholesterol"
  | "hdl_cholesterol"
  | "triglycerides"

  | "stress_level";

/**
 * Canonical metric definition metadata
 * (used later for UI + AI reasoning)
 */
export const CanonicalMetricDefinitions: Record<
  CanonicalHealthMetric,
  {
    label: string;
    category: "sleep" | "activity" | "cardio" | "metabolic" | "nutrition" | "body";
    unit: string;
    higherIsBetter: boolean;
  }
> = {
  sleep_hours: {
    label: "Sleep Duration",
    category: "sleep",
    unit: "hours",
    higherIsBetter: true,
  },
  sleep_efficiency: {
    label: "Sleep Efficiency",
    category: "sleep",
    unit: "%",
    higherIsBetter: true,
  },
  sleep_debt: {
    label: "Sleep Debt",
    category: "sleep",
    unit: "hours",
    higherIsBetter: false,
  },

  daily_steps: {
    label: "Daily Steps",
    category: "activity",
    unit: "steps",
    higherIsBetter: true,
  },
  active_minutes: {
    label: "Active Minutes",
    category: "activity",
    unit: "minutes",
    higherIsBetter: true,
  },
  sedentary_hours: {
    label: "Sedentary Time",
    category: "activity",
    unit: "hours",
    higherIsBetter: false,
  },

  resting_hr: {
    label: "Resting Heart Rate",
    category: "cardio",
    unit: "bpm",
    higherIsBetter: false,
  },
  heart_rate_variability: {
    label: "HRV",
    category: "cardio",
    unit: "ms",
    higherIsBetter: true,
  },
  vo2max: {
    label: "VO2 Max",
    category: "cardio",
    unit: "ml/kg/min",
    higherIsBetter: true,
  },

  recovery_score: {
    label: "Recovery Score",
    category: "cardio",
    unit: "score",
    higherIsBetter: true,
  },
  strain_score: {
    label: "Strain Score",
    category: "cardio",
    unit: "score",
    higherIsBetter: false,
  },

  weight_kg: {
    label: "Weight",
    category: "body",
    unit: "kg",
    higherIsBetter: false,
  },
  body_fat_pct: {
    label: "Body Fat %",
    category: "body",
    unit: "%",
    higherIsBetter: false,
  },
  bmi: {
    label: "BMI",
    category: "body",
    unit: "index",
    higherIsBetter: false,
  },

  calories_burned: {
    label: "Calories Burned",
    category: "nutrition",
    unit: "kcal",
    higherIsBetter: true,
  },
  calories_intake: {
    label: "Calories Intake",
    category: "nutrition",
    unit: "kcal",
    higherIsBetter: false,
  },
  protein_intake: {
    label: "Protein Intake",
    category: "nutrition",
    unit: "g",
    higherIsBetter: true,
  },

  blood_glucose: {
    label: "Blood Glucose",
    category: "metabolic",
    unit: "mg/dL",
    higherIsBetter: false,
  },
  hba1c: {
    label: "HbA1c",
    category: "metabolic",
    unit: "%",
    higherIsBetter: false,
  },
  ldl_cholesterol: {
    label: "LDL Cholesterol",
    category: "metabolic",
    unit: "mg/dL",
    higherIsBetter: false,
  },
  hdl_cholesterol: {
    label: "HDL Cholesterol",
    category: "metabolic",
    unit: "mg/dL",
    higherIsBetter: true,
  },
  triglycerides: {
    label: "Triglycerides",
    category: "metabolic",
    unit: "mg/dL",
    higherIsBetter: false,
  },

  stress_level: {
    label: "Stress Level",
    category: "sleep",
    unit: "score",
    higherIsBetter: false,
  },
};