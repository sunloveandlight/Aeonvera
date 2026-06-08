import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { recordInterventionOutcome } from "@/lib/learning/feedbackLoopEngine";

export type ExecutionEvent = {
  userId: string;
  domain: string;
  action: string;
  priority: number;
  timestamp: string;
};

/**
 * MAIN ENTRY
 */
export async function processExecutionFeedback(params: {
  execution: ExecutionEvent;
  outcome: "success" | "failure" | "unknown";
  confidence?: number;
}) {
  const supabase = getSupabaseAdmin();
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
   * STEP 3 — RETURN RESULT
   */
  return {
    processed: true,
    impact: computeImpact(outcome, confidence),
  };
}

/**
 * IMPACT SCORING
 */
function computeImpact(
  outcome: "success" | "failure" | "unknown",
  confidence: number
): number {
  if (outcome === "success") return 1 * confidence;
  if (outcome === "failure") return -1 * confidence;
  return 0;
}