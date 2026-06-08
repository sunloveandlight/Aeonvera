/**
 * Aeonvera — Coaching Trigger Engine (V1)
 * ---------------------------------------
 * Decides WHEN Aeonvera should actually speak to the user.
 */

import { HealthState } from "@/lib/state/healthStateEngine";
import { Intervention } from "@/lib/intervention/interventionDecisionEngine";

export type CoachTrigger = {
  shouldTrigger: boolean;

  intensity: "silent" | "low" | "medium" | "high";

  mode: "dashboard" | "notification" | "conversation";

  reason: string;

  selectedInterventions: Intervention[];
};

/**
 * MAIN ENTRY
 */
export function evaluateCoachTrigger(params: {
  state: HealthState;
  interventions: Intervention[];
  timeOfDay: number;
  lastInteractionMinutesAgo: number;
  userEngagementScore: number;
}): CoachTrigger {
  const {
    state,
    interventions,
    timeOfDay,
    lastInteractionMinutesAgo,
    userEngagementScore,
  } = params;

  const topRisk = interventions[0];

  const urgencyScore = computeUrgency({
    topRisk,
    state,
    lastInteractionMinutesAgo,
    userEngagementScore,
  });

  const isHighRisk = urgencyScore > 75;
  const isMediumRisk = urgencyScore > 45;

  /**
   * DECISION TREE
   */
  if (isHighRisk) {
    return {
      shouldTrigger: true,
      intensity: "high",
      mode: "conversation",
      reason:
        "High risk + deteriorating pattern requires immediate conversational intervention.",
      selectedInterventions: interventions.slice(0, 2),
    };
  }

  if (isMediumRisk) {
    return {
      shouldTrigger: true,
      intensity: "medium",
      mode: "notification",
      reason:
        "Moderate risk detected — proactive intervention recommended.",
      selectedInterventions: interventions.slice(0, 1),
    };
  }

  /**
   * LOW PRIORITY → NO INTERRUPTIONS
   */
  if (userEngagementScore < 0.3) {
    return {
      shouldTrigger: true,
      intensity: "low",
      mode: "dashboard",
      reason:
        "Low engagement user — passive reinforcement preferred.",
      selectedInterventions: interventions.slice(0, 1),
    };
  }

  return {
    shouldTrigger: false,
    intensity: "silent",
    mode: "dashboard",
    reason: "No meaningful risk escalation detected.",
    selectedInterventions: [],
  };
}

/**
 * URGENCY MODEL (simple but extensible)
 */
function computeUrgency({
  topRisk,
  state,
  lastInteractionMinutesAgo,
  userEngagementScore,
}: any): number {
  const riskScore = topRisk?.priority || 0;

  const inactivityPenalty =
    lastInteractionMinutesAgo > 180
      ? 15
      : lastInteractionMinutesAgo > 60
      ? 8
      : 0;

  const engagementBoost = (1 - userEngagementScore) * 20;

  const volatility =
    Object.values(state.riskScores).reduce(
      (a: number, b: any) => a + b,
      0
    ) / 4;

  return Math.min(
    100,
    riskScore * 0.6 +
      volatility * 0.3 +
      inactivityPenalty +
      engagementBoost
  );
}