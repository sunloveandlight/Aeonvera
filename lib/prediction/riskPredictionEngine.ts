import { HealthState } from "@/lib/state/healthStateEngine";

/**
 * Aeonvera — Risk Prediction Engine (V1)
 * --------------------------------------
 * Converts health state trends into future risk forecasts.
 *
 * This is NOT ML.
 * It is deterministic longitudinal projection.
 */

export type PredictedRisk = {
  domain: "sleep" | "recovery" | "metabolic" | "activity";
  currentRisk: number;
  predictedRisk: number;
  trajectory: "improving" | "stable" | "declining";
  confidence: number;
  explanation: string;
};

/**
 * MAIN ENTRY
 */
export function predictHealthRisks(state: HealthState): PredictedRisk[] {
  const predictions: PredictedRisk[] = [];

  const domains: (keyof HealthState["riskScores"])[] = [
    "sleep",
    "recovery",
    "metabolic",
    "activity",
  ];

  for (const domain of domains) {
    const current = state.riskScores[domain];

    const trend = getTrendSignal(state, domain);

    const predicted = projectRisk(current, trend);

    predictions.push({
      domain,
      currentRisk: current,
      predictedRisk: predicted,
      trajectory: classifyTrajectory(trend),
      confidence: calculateConfidence(state, domain),
      explanation: generateExplanation(domain, current, trend),
    });
  }

  return predictions;
}

/**
 * Extract directional signal from trends + baseline drift
 */
function getTrendSignal(
  state: HealthState,
  domain: keyof HealthState["riskScores"]
): number {
  // Map domain → underlying metrics
  const mapping: Record<string, string[]> = {
    sleep: ["sleep_hours"],
    recovery: ["recovery_score"],
    activity: ["daily_steps"],
    metabolic: ["blood_glucose"],
  };

  const metrics = mapping[domain] || [];

  let signal = 0;

  for (const m of metrics) {
    const trend = state.trends[m];

    if (!trend) continue;

    signal += trend.changePercent;
  }

  return signal;
}

/**
 * Simple projection model
 */
function projectRisk(current: number, trendSignal: number): number {
  // amplify weak signals slightly
  const adjustment = trendSignal * 0.6;

  return clampRisk(current + adjustment);
}

/**
 * Convert numeric signal → category
 */
function classifyTrajectory(
  trendSignal: number
): "improving" | "stable" | "declining" {
  if (trendSignal > 3) return "improving";
  if (trendSignal < -3) return "declining";
  return "stable";
}

/**
 * Confidence is higher when data is stable + abundant
 */
function calculateConfidence(state: HealthState, domain: string): number {
  const trend = Object.values(state.trends).length;

  const base = Math.min(1, trend / 10);

  const volatilityPenalty =
    Math.abs(state.riskScores[domain as keyof HealthState["riskScores"]] - 50) /
    100;

  return Number((base - volatilityPenalty * 0.2).toFixed(2));
}

/**
 * Human-readable reasoning layer
 */
function generateExplanation(
  domain: string,
  current: number,
  trend: number
): string {
  const direction =
    trend > 3 ? "worsening" : trend < -3 ? "improving" : "stable";

  return `${domain} risk is currently ${current} and showing a ${direction} trajectory based on recent trend signals.`;
}

/**
 * Utility
 */
function clampRisk(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}