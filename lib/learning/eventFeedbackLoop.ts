/**
 * Aeonvera — Event Feedback Loop Binding (STEP 34)
 * -------------------------------------------------
 * Connects execution → outcomes → learning → personality evolution
 */

import { supabase } from "@/lib/supabase/client";
import { recordInterventionOutcome } from "@/lib/learning/feedbackLoopEngine";

export type ExecutionEvent = {
  userId: string;
  domain: string;
  action: string;
  priority: number;
  timestamp: string;
};

/**
 * =========================
 * MAIN ENTRY
 * =========================
 */
export async function processExecutionFeedback(params: {
  execution: ExecutionEvent;
  /**
   * Outcome can be:
   * - success (user followed advice / system improved)
   * - failure (ignored / no change)
   * - unknown (no signal yet)
   */
  outcome: "success" | "failure" | "unknown";
  confidence?: number;
}) {
  const { execution, outcome, confidence = 0.5 } = params;

  /**
   * STEP 1 — STORE RAW OUTCOME SIGNAL
   */
  await recordInterventionOutcome({
    userId: execution.userId,
    action: execution.action,
    domain: execution.domain,
    success: outcome === "success",
    confidence,
    timestamp: execution.timestamp,
  });

  /**
   * STEP 2 — STORE SYSTEM FEEDBACK EVENT
   */
  await supabase.from("behavior_feedback_events").insert({
    user_id: execution.userId,
    domain: execution.domain,
    action: execution.action,
    outcome,
    confidence,
    created_at: new Date().toISOString(),
  });

  /**
   * STEP 3 — OPTIONAL META SIGNAL LOGGING
   */
  return {
    processed: true,
    impact: computeImpact(outcome, confidence),
  };
}

/**
 * =========================
 * IMPACT SCORING
 * =========================
 */
function computeImpact(
  outcome: "success" | "failure" | "unknown",
  confidence: number
): number {
  if (outcome === "success") return 1 * confidence;
  if (outcome === "failure") return -1 * confidence;
  return 0;
}