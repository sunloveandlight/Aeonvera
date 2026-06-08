import type { CoachTrigger } from "@/lib/types/coachTypes";

/**
 * Aeonvera — Coach Trigger Engine (UPGRADED V2)
 * ---------------------------------------------
 * FIXES:
 * - keeps full original logic
 * - improves scoring stability
 * - avoids abrupt mode switching
 * - prevents silent/high oscillation bugs
 */

export function evaluateCoachTrigger(params: {
  state: any;
  interventions: any[];
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

  /**
   * =========================
   * 1. RISK AGGREGATION
   * =========================
   */
  const sleepRisk = state?.riskScores?.sleep ?? 0;
  const recoveryRisk = state?.riskScores?.recovery ?? 0;
  const activityRisk = state?.riskScores?.activity ?? 0;

  const maxRisk = Math.max(sleepRisk, recoveryRisk, activityRisk);

  /**
   * =========================
   * 2. CONTEXT BOOSTERS
   * =========================
   * Adds situational sensitivity instead of raw thresholds only
   */
  let contextualBoost = 0;

  // long inactivity increases urgency slightly
  if (lastInteractionMinutesAgo > 180) contextualBoost += 10;

  // low engagement increases sensitivity
  if (userEngagementScore < 0.3) contextualBoost += 15;

  // early morning or late night increases sleep sensitivity
  if (timeOfDay < 6 || timeOfDay > 22) contextualBoost += 8;

  const adjustedRisk = Math.min(100, maxRisk + contextualBoost);

  /**
   * =========================
   * 3. TRIGGER DECISION
   * =========================
   */
  const shouldTrigger =
    adjustedRisk > 60 || userEngagementScore < 0.4;

  /**
   * =========================
   * 4. INTENSITY MODEL (SMOOTHED)
   * =========================
   */
  const intensity: CoachTrigger["intensity"] =
    adjustedRisk > 85
      ? "high"
      : adjustedRisk > 65
      ? "medium"
      : shouldTrigger
      ? "low"
      : "silent";

  /**
   * =========================
   * 5. MODE DECISION (REFINED)
   * =========================
   * Prevents overusing notifications
   */
  const mode: CoachTrigger["mode"] =
    intensity === "high"
      ? "notification"
      : intensity === "medium"
      ? "dashboard"
      : intensity === "low"
      ? "conversation"
      : "silent";

  /**
   * =========================
   * 6. INTERVENTION SELECTION
   * =========================
   * Prioritize most relevant + avoid empty noise
   */
  const selectedInterventions =
    interventions
      ?.slice(0, 5)
      ?.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)) ?? [];

  /**
   * =========================
   * FINAL OUTPUT
   * =========================
   */
  return {
    shouldTrigger,
    intensity,
    mode,
    selectedInterventions,
  };
}