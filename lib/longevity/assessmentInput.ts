import type { AssessmentInput } from "@/lib/longevity/biologicalAgeEngine";

type AssessmentRow = Record<string, unknown>;

export function buildAssessmentInput(assessment: AssessmentRow): AssessmentInput {
  return {
    age: Number(assessment.age) || 30,
    sex: stringValue(assessment.sex) || "unknown",
    height_cm: Number(assessment.height_cm) || 170,
    weight_kg: Number(assessment.weight_kg) || 70,
    sleep_hours: Number(assessment.sleep_hours) || 7,
    sleep_quality: Number(assessment.sleep_quality) || 5,
    exercise_days: Number(assessment.exercise_days) || 0,
    strength_training:
      stringValue(assessment.strength_training)?.toLowerCase() === "yes",
    diet_type: stringValue(assessment.diet_type) || "standard",
    alcohol_use: stringValue(assessment.alcohol_use) || "none",
    smoking: stringValue(assessment.smoking) || "never",
    stress_level: Number(assessment.stress_level) || 5,
    primary_goal: stringValue(assessment.primary_goal) || "",

    resting_hr: safeNum(assessment.resting_hr),
    blood_pressure_systolic: safeNum(assessment.blood_pressure_systolic),
    blood_pressure_diastolic: safeNum(assessment.blood_pressure_diastolic),
    vo2_max: safeNum(assessment.vo2_max),
    hrv: safeNum(assessment.hrv),

    fasting_glucose: safeNum(assessment.fasting_glucose),
    hba1c: safeNum(assessment.hba1c),
    total_cholesterol: safeNum(assessment.total_cholesterol),
    ldl: safeNum(assessment.ldl),
    hdl: safeNum(assessment.hdl),
    triglycerides: safeNum(assessment.triglycerides),
    fasting_insulin: safeNum(assessment.fasting_insulin),
    hscrp: safeNum(assessment.hscrp),

    body_fat_pct: safeNum(assessment.body_fat_pct),
    waist_cm: safeNum(assessment.waist_cm),

    recovery_quality: safeNum(assessment.recovery_quality),
    screen_time_before_bed:
      stringValue(assessment.screen_time_before_bed) || undefined,

    water_intake: stringValue(assessment.water_intake) || undefined,
    caffeine_intake: stringValue(assessment.caffeine_intake) || undefined,
    fasting_type: stringValue(assessment.fasting_type) || undefined,
    supplements: stringValue(assessment.supplements) || undefined,
    sunlight_hours: stringValue(assessment.sunlight_hours) || undefined,
    cold_exposure: stringValue(assessment.cold_exposure) || undefined,

    anxiety_level: safeNum(assessment.anxiety_level),
    cognitive_score: safeNum(assessment.cognitive_score),
    social_connection: safeNum(assessment.social_connection),
    purpose_score: safeNum(assessment.purpose_score),

    testosterone: safeNum(assessment.testosterone),
    cortisol: safeNum(assessment.cortisol),

    family_heart_disease:
      stringValue(assessment.family_heart_disease) || undefined,
    family_cancer: stringValue(assessment.family_cancer) || undefined,
    family_diabetes: stringValue(assessment.family_diabetes) || undefined,
    family_longevity: stringValue(assessment.family_longevity) || undefined,
  };
}

export function safeNum(value: unknown): number | undefined {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && value !== "" && value != null
    ? numberValue
    : undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}
