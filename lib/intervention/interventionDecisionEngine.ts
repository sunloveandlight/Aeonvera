/**
 * Aeonvera — Intervention Decision Engine (STEP 25 NULL-SAFE FIX)
 * ----------------------------------------------------------------
 * FIXES:
 * - personality.empathy possibly undefined
 * - personality.strictness unsafe comparisons
 * - ensures deterministic runtime-safe defaults
 */

import type { UserMemorySnapshot } from "@/lib/memory/conversationMemoryFusionEngine";
import type { PersonalityState } from "@/lib/personality/adaptivePersonalityEngine";

/**
 * =========================
 * CONTEXT TYPE
 * =========================
 */
export type InterventionContext = {
  memory?: UserMemorySnapshot | null;
  personality?: PersonalityState | null;
};

/**
 * =========================
 * INTERVENTION TYPE
 * =========================
 */
export type Intervention = {
  domain: string;
  action: string;
  reason?: string;
  priority: number;
};

type HealthStateLike = {
  riskScores?: Partial<Record<"activity" | "recovery" | "sleep", number>>;
};

type PredictionLike = Record<string, unknown>;

type AdaptiveWeightLike = Array<{
  confidence?: number;
  domain?: string;
  weight?: number;
}>;

/**
 * =========================
 * SAFE PERSONALITY NORMALIZER
 * =========================
 */
function normalizePersonality(personality?: PersonalityState | null) {
  return {
    strictness: personality?.strictness ?? 50,
    empathy: personality?.empathy ?? 50,
    proactivity: personality?.proactivity ?? 50,
  };
}

/**
 * =========================
 * MAIN ENTRY
 * =========================
 */
export function generateInterventions(
  state: HealthStateLike | null | undefined,
  predictions: PredictionLike | null | undefined,
  adaptiveWeights: AdaptiveWeightLike | null | undefined,
  context?: InterventionContext
): Intervention[] {
  void predictions;
  void adaptiveWeights;
  const memory = context?.memory ?? null;
  const personality = normalizePersonality(context?.personality);

  const interventions: Intervention[] = [];

  /**
   * =========================
   * SLEEP DOMAIN
   * =========================
   */
  if ((state?.riskScores?.sleep ?? 0) > 60) {
    interventions.push({
      domain: "sleep",
      action: "improve_sleep_quality",
      reason:
        personality.strictness > 70
          ? "Sleep risk is critical — immediate correction required."
          : memory?.summary
          ? "Sleep risk elevated (based on historical + current patterns)"
          : "Sleep risk elevated based on current state",
      priority: 10,
    });
  }

  /**
   * =========================
   * RECOVERY DOMAIN
   * =========================
   */
  if ((state?.riskScores?.recovery ?? 0) > 60) {
    interventions.push({
      domain: "recovery",
      action: "improve_recovery",
      reason:
        personality.empathy > 70
          ? "Your recovery system needs support — let's stabilize it gently."
          : "Recovery capacity is under strain",
      priority: 9,
    });
  }

  /**
   * =========================
   * ACTIVITY DOMAIN
   * =========================
   */
  if ((state?.riskScores?.activity ?? 0) > 60) {
    interventions.push({
      domain: "activity",
      action: "increase_movement",
      reason: memory?.recurringTopics?.includes("activity")
        ? "Repeated inactivity pattern detected in behavioral history"
        : "Low activity detected in current state",
      priority: 8,
    });
  }

  /**
   * =========================
   * EMOTIONAL LAYER
   * =========================
   */
  if (memory?.dominantEmotionalTone === "negative") {
    interventions.push({
      domain: "emotional",
      action: "support_emotional_state",
      reason:
        personality.empathy > 75
          ? "You’ve been under emotional strain — I’m here to support you through it."
          : "Negative emotional pattern detected in conversation history",
      priority: 7,
    });
  }

  /**
   * =========================
   * FALLBACK
   * =========================
   */
  if (interventions.length === 0) {
    interventions.push({
      domain: "maintenance",
      action: "maintain_current_state",
      reason: "No significant risks detected",
      priority: 1,
    });
  }

  return interventions.sort((a, b) => b.priority - a.priority);
}
