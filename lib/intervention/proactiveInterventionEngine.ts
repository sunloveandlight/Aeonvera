/**
 * Aeonvera — Proactive Intervention Engine (STEP 31 FIXED)
 * --------------------------------------------------------
 * NO dependency on deleted prediction file
 */

import type { PersonalityState } from "@/lib/personality/adaptivePersonalityEngine";

/**
 * =========================
 * LOCAL PREDICTION TYPE (SELF-CONTAINED)
 * =========================
 */
export type PredictedRisk = {
  domain: "sleep" | "recovery" | "activity" | "metabolic";
  currentRisk: number;
  predictedRisk: number;
  trajectory: "improving" | "stable" | "declining";
  confidence: number;
};

/**
 * =========================
 * OUTPUT TYPE
 * =========================
 */
export type ProactiveIntervention = {
  domain: string;
  decision: "intervene_now" | "intervene_soon" | "monitor" | "ignore";
  urgency: number;
  reason: string;
};

/**
 * =========================
 * MAIN ENTRY
 * =========================
 */
export function generateProactiveInterventions(params: {
  predictions: PredictedRisk[];
  personality?: PersonalityState | null;
  memory?: any;
}): ProactiveIntervention[] {
  const { predictions, personality, memory } = params;

  const p = {
    strictness: personality?.strictness ?? 50,
    empathy: personality?.empathy ?? 50,
    proactivity: personality?.proactivity ?? 50,
  };

  const results: ProactiveIntervention[] = [];

  for (const risk of predictions) {
    const decision = decide(risk, p);

    results.push({
      domain: risk.domain,
      decision,
      urgency: computeUrgency(risk, p),
      reason: buildReason(risk, decision),
    });
  }

  return results.sort((a, b) => b.urgency - a.urgency);
}

/**
 * =========================
 * DECISION LOGIC
 * =========================
 */
function decide(
  risk: PredictedRisk,
  personality: { strictness: number; empathy: number; proactivity: number }
): ProactiveIntervention["decision"] {
  const delta = risk.predictedRisk - risk.currentRisk;

  const high = risk.predictedRisk > 70 || delta > 10;
  const medium = risk.predictedRisk > 50;

  if (high && personality.strictness > 60) return "intervene_now";
  if (high) return "intervene_soon";
  if (medium && personality.proactivity > 60) return "monitor";

  return "ignore";
}

/**
 * =========================
 * URGENCY
 * =========================
 */
function computeUrgency(
  risk: PredictedRisk,
  personality: { strictness: number; empathy: number; proactivity: number }
): number {
  let u = risk.predictedRisk;

  if (risk.trajectory === "declining") u += 10;
  if (personality.strictness > 70) u += 5;
  if (personality.proactivity > 70) u += 5;

  return Math.min(100, u);
}

/**
 * =========================
 * REASONING
 * =========================
 */
function buildReason(
  risk: PredictedRisk,
  decision: ProactiveIntervention["decision"]
): string {
  switch (decision) {
    case "intervene_now":
      return `${risk.domain} risk is rapidly worsening — immediate action required.`;

    case "intervene_soon":
      return `${risk.domain} risk is trending upward — early intervention recommended.`;

    case "monitor":
      return `${risk.domain} shows instability — continue monitoring.`;

    case "ignore":
    default:
      return `${risk.domain} is stable — no action needed.`;
  }
}