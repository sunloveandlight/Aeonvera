/**
 * Aeonvera — Unified Learning Ingestor (STEP 35)
 * ---------------------------------------------
 * SINGLE SOURCE OF TRUTH for all learning signals
 */

import { supabase } from "@/lib/supabase/client";

/**
 * =========================
 * CORE EVENT TYPE
 * =========================
 */
export type LearningEvent = {
  userId: string;
  domain: string;
  action: string;

  outcome: "success" | "failure" | "unknown";
  confidence: number;

  source: "execution" | "manual" | "system";

  timestamp: string;
};

/**
 * =========================
 * MAIN ENTRY
 * =========================
 */
export async function ingestLearningEvent(event: LearningEvent) {
  /**
   * STEP 1 — WRITE TO CANONICAL TABLE
   */
  await supabase.from("intervention_outcomes").insert({
    user_id: event.userId,
    domain: event.domain,
    action: event.action,
    success: event.outcome === "success",
    confidence: event.confidence,
    created_at: event.timestamp,
  });

  /**
   * STEP 2 — WRITE RAW EVENT LOG (AUDIT TRAIL)
   */
  await supabase.from("behavior_learning_events").insert({
    user_id: event.userId,
    domain: event.domain,
    action: event.action,
    outcome: event.outcome,
    confidence: event.confidence,
    source: event.source,
    created_at: event.timestamp,
  });

  return {
    stored: true,
    normalized: true,
  };
}