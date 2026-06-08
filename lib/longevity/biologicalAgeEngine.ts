/**
 * Aeonvera — Biological Age Engine (V1)
 * --------------------------------------
 * Computes a biological age estimate from assessment data.
 *
 * Based on a simplified PhenoAge-inspired scoring model.
 * Uses lifestyle factors as proxies for biomarker data
 * until lab integration is available.
 *
 * Score is designed to be:
 * - Meaningful on first use (assessment only)
 * - Improvable over time as habits change
 * - Explainable to the user
 */

export type AssessmentInput = {
  age: number;
  sex: string;
  height_cm: number;
  weight_kg: number;
  sleep_hours: number;
  sleep_quality: number;
  exercise_days: number;
  strength_training: boolean;
  diet_type: string;
  alcohol_use: string;
  smoking: string;
  stress_level: number;
  primary_goal: string;
};

export type BiologicalAgeResult = {
  chronologicalAge: number;
  biologicalAge: number;
  ageDelta: number; // negative = younger than age, positive = older
  score: number; // 0-100 overall health score
  category: "excellent" | "good" | "average" | "poor";
  factors: BiologicalAgeFactor[];
  summary: string;
};

export type BiologicalAgeFactor = {
  domain: string;
  impact: number; // years added (+) or removed (-) from biological age
  label: string;
  status: "positive" | "neutral" | "negative";
};

/**
 * MAIN ENTRY
 */
export function computeBiologicalAge(
  input: AssessmentInput
): BiologicalAgeResult {
  const factors: BiologicalAgeFactor[] = [];
  let ageDelta = 0;

  /**
   * =========================
   * SLEEP FACTOR
   * Optimal: 7-9 hours, quality 7+
   * =========================
   */
  const sleepImpact = computeSleepImpact(
    input.sleep_hours,
    input.sleep_quality
  );
  ageDelta += sleepImpact.impact;
  factors.push(sleepImpact);

  /**
   * =========================
   * EXERCISE FACTOR
   * Optimal: 4+ days/week, includes strength
   * =========================
   */
  const exerciseImpact = computeExerciseImpact(
    input.exercise_days,
    input.strength_training
  );
  ageDelta += exerciseImpact.impact;
  factors.push(exerciseImpact);

  /**
   * =========================
   * BMI FACTOR
   * Optimal: 18.5-24.9
   * =========================
   */
  const bmiImpact = computeBMIImpact(input.weight_kg, input.height_cm);
  ageDelta += bmiImpact.impact;
  factors.push(bmiImpact);

  /**
   * =========================
   * STRESS FACTOR
   * Optimal: 1-3 (low stress)
   * =========================
   */
  const stressImpact = computeStressImpact(input.stress_level);
  ageDelta += stressImpact.impact;
  factors.push(stressImpact);

  /**
   * =========================
   * DIET FACTOR
   * =========================
   */
  const dietImpact = computeDietImpact(input.diet_type);
  ageDelta += dietImpact.impact;
  factors.push(dietImpact);

  /**
   * =========================
   * SMOKING FACTOR
   * Most significant negative factor
   * =========================
   */
  const smokingImpact = computeSmokingImpact(input.smoking);
  ageDelta += smokingImpact.impact;
  factors.push(smokingImpact);

  /**
   * =========================
   * ALCOHOL FACTOR
   * =========================
   */
  const alcoholImpact = computeAlcoholImpact(input.alcohol_use);
  ageDelta += alcoholImpact.impact;
  factors.push(alcoholImpact);

  /**
   * =========================
   * FINAL COMPUTATION
   * =========================
   */
  const biologicalAge = Math.max(
    18,
    Math.round(input.age + ageDelta)
  );

  const score = computeOverallScore(ageDelta);
  const category = classifyCategory(ageDelta);
  const summary = buildSummary(
    input.age,
    biologicalAge,
    ageDelta,
    category
  );

  return {
    chronologicalAge: input.age,
    biologicalAge,
    ageDelta: Number(ageDelta.toFixed(1)),
    score,
    category,
    factors: factors.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)),
    summary,
  };
}

/**
 * =========================
 * FACTOR ENGINES
 * =========================
 */

function computeSleepImpact(
  hours: number,
  quality: number
): BiologicalAgeFactor {
  let impact = 0;

  if (hours >= 7 && hours <= 9) {
    impact -= 1.5;
  } else if (hours < 6) {
    impact += 2.5;
  } else if (hours < 7) {
    impact += 1.0;
  } else {
    impact += 0.5;
  }

  if (quality >= 8) impact -= 1.0;
  else if (quality <= 4) impact += 1.5;

  return {
    domain: "Sleep",
    impact: Number(impact.toFixed(1)),
    label:
      impact < 0
        ? "Excellent sleep is reducing your biological age"
        : impact > 1
        ? "Poor sleep is accelerating biological aging"
        : "Sleep is within acceptable range",
    status: impact < -0.5 ? "positive" : impact > 1 ? "negative" : "neutral",
  };
}

function computeExerciseImpact(
  days: number,
  strengthTraining: boolean
): BiologicalAgeFactor {
  let impact = 0;

  if (days >= 5) {
    impact -= 2.5;
  } else if (days >= 3) {
    impact -= 1.5;
  } else if (days >= 1) {
    impact += 0.5;
  } else {
    impact += 3.0;
  }

  if (strengthTraining) impact -= 1.5;

  return {
    domain: "Exercise",
    impact: Number(impact.toFixed(1)),
    label:
      impact < -1
        ? "Strong exercise habit is reducing biological age"
        : impact > 1
        ? "Low activity is accelerating biological aging"
        : "Activity level is acceptable",
    status: impact < -0.5 ? "positive" : impact > 1 ? "negative" : "neutral",
  };
}

function computeBMIImpact(
  weight_kg: number,
  height_cm: number
): BiologicalAgeFactor {
  const heightM = height_cm / 100;
  const bmi = weight_kg / (heightM * heightM);

  let impact = 0;

  if (bmi >= 18.5 && bmi <= 24.9) {
    impact -= 1.0;
  } else if (bmi >= 25 && bmi <= 29.9) {
    impact += 1.5;
  } else if (bmi >= 30) {
    impact += 3.5;
  } else {
    impact += 1.0;
  }

  return {
    domain: "Body Composition",
    impact: Number(impact.toFixed(1)),
    label:
      impact < 0
        ? "Healthy BMI is supporting longevity"
        : impact > 2
        ? "BMI is significantly impacting biological age"
        : "BMI has minor impact on biological age",
    status: impact < 0 ? "positive" : impact > 2 ? "negative" : "neutral",
  };
}

function computeStressImpact(stressLevel: number): BiologicalAgeFactor {
  let impact = 0;

  if (stressLevel <= 3) {
    impact -= 1.5;
  } else if (stressLevel <= 6) {
    impact += 0.5;
  } else if (stressLevel <= 8) {
    impact += 2.0;
  } else {
    impact += 3.5;
  }

  return {
    domain: "Stress",
    impact: Number(impact.toFixed(1)),
    label:
      impact < 0
        ? "Low stress is protecting your biological age"
        : impact > 2
        ? "High stress is accelerating biological aging"
        : "Stress has moderate impact",
    status: impact < 0 ? "positive" : impact > 1.5 ? "negative" : "neutral",
  };
}

function computeDietImpact(dietType: string): BiologicalAgeFactor {
  const diet = dietType.toLowerCase();
  let impact = 0;

  if (
    diet.includes("mediterranean") ||
    diet.includes("whole food") ||
    diet.includes("plant")
  ) {
    impact -= 2.0;
  } else if (
    diet.includes("vegetarian") ||
    diet.includes("vegan") ||
    diet.includes("keto") ||
    diet.includes("paleo")
  ) {
    impact -= 1.0;
  } else if (
    diet.includes("processed") ||
    diet.includes("fast food") ||
    diet.includes("junk")
  ) {
    impact += 2.5;
  } else {
    impact += 0.5;
  }

  return {
    domain: "Nutrition",
    impact: Number(impact.toFixed(1)),
    label:
      impact < -1
        ? "Excellent diet is reducing biological age"
        : impact > 1.5
        ? "Diet quality is accelerating biological aging"
        : "Diet has minor impact",
    status: impact < -0.5 ? "positive" : impact > 1 ? "negative" : "neutral",
  };
}

function computeSmokingImpact(smoking: string): BiologicalAgeFactor {
  const s = smoking.toLowerCase();
  let impact = 0;

  if (s.includes("never") || s === "no") {
    impact -= 0.5;
  } else if (s.includes("former") || s.includes("quit")) {
    impact += 1.5;
  } else if (s.includes("occasional") || s.includes("social")) {
    impact += 3.0;
  } else if (s.includes("yes") || s.includes("daily") || s.includes("current")) {
    impact += 6.0;
  }

  return {
    domain: "Smoking",
    impact: Number(impact.toFixed(1)),
    label:
      impact <= 0
        ? "Non-smoker status is protecting longevity"
        : impact >= 5
        ? "Smoking is the largest accelerant of biological aging"
        : "Smoking history has moderate impact",
    status: impact <= 0 ? "positive" : impact >= 4 ? "negative" : "neutral",
  };
}

function computeAlcoholImpact(alcoholUse: string): BiologicalAgeFactor {
  const a = alcoholUse.toLowerCase();
  let impact = 0;

  if (a.includes("never") || a === "none" || a === "no") {
    impact -= 0.5;
  } else if (a.includes("occasional") || a.includes("social") || a.includes("light")) {
    impact += 0.5;
  } else if (a.includes("moderate")) {
    impact += 1.5;
  } else if (a.includes("heavy") || a.includes("daily")) {
    impact += 4.0;
  } else {
    impact += 1.0;
  }

  return {
    domain: "Alcohol",
    impact: Number(impact.toFixed(1)),
    label:
      impact <= 0
        ? "Alcohol intake is not impacting biological age"
        : impact >= 3
        ? "Alcohol consumption is significantly aging the biological system"
        : "Moderate alcohol impact detected",
    status: impact <= 0 ? "positive" : impact >= 3 ? "negative" : "neutral",
  };
}

/**
 * =========================
 * SCORING + CLASSIFICATION
 * =========================
 */

function computeOverallScore(ageDelta: number): number {
  // ageDelta of -10 = score 100, ageDelta of +10 = score 0
  const score = 50 - ageDelta * 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function classifyCategory(
  ageDelta: number
): BiologicalAgeResult["category"] {
  if (ageDelta <= -3) return "excellent";
  if (ageDelta <= 0) return "good";
  if (ageDelta <= 4) return "average";
  return "poor";
}

function buildSummary(
  chronological: number,
  biological: number,
  delta: number,
  category: BiologicalAgeResult["category"]
): string {
  const direction = delta < 0 ? "younger" : "older";
  const years = Math.abs(delta).toFixed(1);

  const categoryText = {
    excellent: "Your biological system is performing exceptionally well.",
    good: "Your biological system is in good health.",
    average: "Your biological system shows room for optimization.",
    poor: "Your biological system requires significant intervention.",
  }[category];

  return `At ${chronological} years old, your biological age is ${biological}. You are ${years} years ${direction} than your chronological age. ${categoryText}`;
}