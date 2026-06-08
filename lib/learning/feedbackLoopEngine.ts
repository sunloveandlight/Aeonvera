/**
 * Aeonvera — Adaptive Feedback Loop Engine (STEP 28)
 * ---------------------------------------------------
 * Closes the intelligence loop by learning from user behavior
 */

import { supabase } from "@/lib/supabase/client";

export type InterventionOutcome = {
  userId: string;
  action: string;
  domain: string;
  success: boolean;
  confidence: number;
  timestamp: string;
};

/**
 * =========================
 * RECORD OUTCOME
 * =========================
 */
export async function recordInterventionOutcome(
  outcome: InterventionOutcome
) {
  const { error } = await supabase.from("intervention_outcomes").insert({
    user_id: outcome.userId,
    action: outcome.action,
    domain: outcome.domain,
    success: outcome.success,
    confidence: outcome.confidence,
    created_at: outcome.timestamp,
  });

  if (error) {
    console.error("[Outcome Logging Failed]", error.message);
  }

  return { status: "recorded" };
}

/**
 * =========================
 * FETCH USER LEARNING SIGNAL
 * =========================
 */
export async function getUserLearningProfile(userId: string) {
  const { data } = await supabase
    .from("intervention_outcomes")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  const outcomes = data || [];

  const successRate =
    outcomes.length > 0
      ? outcomes.filter((o) => o.success).length / outcomes.length
      : 0.5;

  const domainEffectiveness: Record<string, number> = {};

  for (const o of outcomes) {
    if (!domainEffectiveness[o.domain]) {
      domainEffectiveness[o.domain] = 0;
    }

    domainEffectiveness[o.domain] += o.success ? 1 : -1;
  }

  return {
    successRate,
    domainEffectiveness,
    totalSamples: outcomes.length,
  };
}