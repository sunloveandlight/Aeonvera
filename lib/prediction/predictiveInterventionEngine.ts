/**
 * Aeonvera — Predictive Intervention Engine (STEP 30)
 * ----------------------------------------------------
 * Moves system from reactive → predictive coaching
 */

export type PredictedRisk = {
  domain: "sleep" | "recovery" | "activity" | "metabolic" | "emotional";
  currentRisk: number;
  predictedRisk: number;
  trajectory: "improving" | "stable" | "declining";
  confidence: number;
};

export type PredictionContext = {
  healthState: any;
  memory: any;
  personality: any;
};

/**
 * =========================
 * MAIN ENTRY
 * =========================
 */
export function generatePredictedRisks(
  ctx: PredictionContext
): PredictedRisk[] {
  const { healthState, memory, personality } = ctx;

  const risks: PredictedRisk[] = [];

  /**
   * =========================
   * SLEEP FORECAST
   * =========================
   */
  const sleepTrend = healthState?.trends?.sleep_hours?.changePercent ?? 0;
  const sleepCurrent = healthState?.riskScores?.sleep ?? 0;

  const sleepPredicted = forecastRisk(sleepCurrent, sleepTrend, memory);

  risks.push({
    domain: "sleep",
    currentRisk: sleepCurrent,
    predictedRisk: sleepPredicted,
    trajectory: getTrajectory(sleepTrend),
    confidence: 0.7,
  });

  /**
   * =========================
   * RECOVERY FORECAST
   * =========================
   */
  const recoveryTrend =
    healthState?.trends?.recovery_score?.changePercent ?? 0;
  const recoveryCurrent = healthState?.riskScores?.recovery ?? 0;

  const recoveryPredicted = forecastRisk(
    recoveryCurrent,
    recoveryTrend,
    memory
  );

  risks.push({
    domain: "recovery",
    currentRisk: recoveryCurrent,
    predictedRisk: recoveryPredicted,
    trajectory: getTrajectory(recoveryTrend),
    confidence: 0.7,
  });

  /**
   * =========================
   * ACTIVITY FORECAST
   * =========================
   */
  const activityCurrent = healthState?.riskScores?.activity ?? 0;

  const activityTrend =
    memory?.recurringTopics?.includes("sedentary") ? -5 : 0;

  const activityPredicted = forecastRisk(
    activityCurrent,
    activityTrend,
    memory
  );

  risks.push({
    domain: "activity",
    currentRisk: activityCurrent,
    predictedRisk: activityPredicted,
    trajectory: getTrajectory(activityTrend),
    confidence: 0.6,
  });

  return risks;
}

/**
 * =========================
 * RISK FORECAST MODEL (V1)
 * =========================
 */
function forecastRisk(
  current: number,
  trend: number,
  memory: any
): number {
  let predicted = current;

  /**
   * trend extrapolation
   */
  predicted += trend * 2;

  /**
   * behavioral memory influence
   */
  if (memory?.recurringTopics?.length > 3) {
    predicted += 5;
  }

  if (memory?.dominantEmotionalTone === "negative") {
    predicted += 5;
  }

  /**
   * clamp
   */
  return Math.max(0, Math.min(100, Math.round(predicted)));
}

/**
 * =========================
 * TRAJECTORY CLASSIFIER
 * =========================
 */
function getTrajectory(trend: number) {
  if (trend > 2) return "improving";
  if (trend < -2) return "declining";
  return "stable";
}