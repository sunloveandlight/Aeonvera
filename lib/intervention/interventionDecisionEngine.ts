/**
 * Aeonvera — Intervention Decision Engine (V1)
 * -------------------------------------------
 * Converts health state + predictions into actionable next steps.
 */

import { HealthState } from "@/lib/state/healthStateEngine";
import { PredictedRisk } from "@/lib/prediction/riskPredictionEngine";

export type Intervention = {
  domain: "sleep" | "recovery" | "activity" | "metabolic";
  priority: number;
  action: string;
  reason: string;
  expectedImpact: "low" | "medium" | "high";
};

/**
 * MAIN ENTRY
 */
export function generateInterventions(
  state: HealthState,
  predictions: PredictedRisk[],
  adaptiveWeights: { domain: string; weight: number }[]
): Intervention[] {
  const interventions: Intervention[] = [];

  const weightMap = Object.fromEntries(
    adaptiveWeights.map((w) => [w.domain, w.weight])
  );

  /**
   * STEP 1 — SCORE EACH DOMAIN
   */
  const domains = [
    "sleep",
    "recovery",
    "activity",
    "metabolic",
  ] as const;

  for (const domain of domains) {
    const currentRisk = state.riskScores[domain] ?? 0;

    const predicted = predictions?.find((p) => p.domain === domain);

    const weight = weightMap[domain] ?? 1.0;

    const riskGrowth = predicted
      ? predicted.predictedRisk - predicted.currentRisk
      : 0;

    const priorityScore =
      currentRisk * 0.6 +
      Math.max(0, riskGrowth) * 0.3 +
      (1 - weight) * 20;

    interventions.push({
      domain,
      priority: priorityScore,
      action: getAction(domain, currentRisk),
      reason: generateReason(domain, currentRisk, riskGrowth),
      expectedImpact: getImpact(currentRisk),
    });
  }

  return interventions.sort((a, b) => b.priority - a.priority);
}

/**
 * DOMAIN ACTIONS
 */
function getAction(domain: string, risk: number): string {
  switch (domain) {
    case "sleep":
      return risk > 70
        ? "Immediate sleep schedule correction"
        : "Optimize sleep consistency";

    case "activity":
      return risk > 70
        ? "Urgent movement increase (walking protocol)"
        : "Increase daily movement baseline";

    case "recovery":
      return risk > 70
        ? "Reduce training load for 48–72 hours"
        : "Balance training and recovery";

    case "metabolic":
      return risk > 70
        ? "Correct metabolic imbalance immediately"
        : "Improve metabolic stability via lifestyle adjustments";

    default:
      return "General optimization";
  }
}

/**
 * REASONING LAYER
 */
function generateReason(
  domain: string,
  risk: number,
  growth: number
): string {
  const trend =
    growth > 5
      ? "worsening trend"
      : growth < -5
      ? "improving trend"
      : "stable trend";

  return `${domain} risk is ${risk.toFixed(
    1
  )} with a ${trend}. This is driving prioritization.`;
}

/**
 * IMPACT ESTIMATION
 */
function getImpact(risk: number): "low" | "medium" | "high" {
  if (risk > 75) return "high";
  if (risk > 40) return "medium";
  return "low";
}