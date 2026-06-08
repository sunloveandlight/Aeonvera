/**
 * Aeonvera — Intervention Decision Engine (STEP 24 UPDATED)
 * ---------------------------------------------------------
 * Now memory-aware, backward compatible, and TypeScript-safe.
 */

import type { UserMemorySnapshot } from "@/lib/memory/conversationMemoryFusionEngine";

export type Intervention = {
  domain: string;
  action: string;
  reason?: string;
  priority: number;
};

export type InterventionContext = {
  memory?: UserMemorySnapshot | null;
};

/**
 * MAIN ENTRY (STEP 24 SAFE SIGNATURE)
 * -----------------------------------
 * Supports both:
 * - v1: 3 args (legacy)
 * - v2: 4 args (memory-aware)
 */
export function generateInterventions(
  state: any,
  predictions: any,
  adaptiveWeights: any,
  memoryOrContext?: UserMemorySnapshot | InterventionContext | null
): Intervention[] {
  // Normalize memory input (supports both calling styles)
  const memory: UserMemorySnapshot | null =
    (memoryOrContext as InterventionContext)?.memory ??
    (memoryOrContext as UserMemorySnapshot) ??
    null;

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
      reason: memory?.summary
        ? "Sleep risk elevated (memory-aware pattern detected)"
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
      reason: "Recovery capacity is under strain",
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
        ? "Repeated inactivity pattern detected in historical behavior"
        : "Low activity detected in current state",
      priority: 8,
    });
  }

  /**
   * =========================
   * MEMORY ENHANCEMENT LAYER
   * =========================
   * This is where Aeonvera starts becoming adaptive
   */
  if (memory?.dominantEmotionalTone === "negative") {
    interventions.push({
      domain: "emotional",
      action: "support_emotional_state",
      reason: "User shows sustained negative emotional tone in conversation history",
      priority: 7,
    });
  }

  /**
   * FALLBACK
   */
  if (interventions.length === 0) {
    interventions.push({
      domain: "maintenance",
      action: "maintain_current_state",
      reason: "No significant risks detected",
      priority: 1,
    });
  }

  /**
   * Sort by priority (highest first)
   */
  return interventions.sort((a, b) => b.priority - a.priority);
}