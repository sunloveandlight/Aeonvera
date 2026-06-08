/**
 * Aeonvera — Unified Brain Orchestrator (STEP 32 FIXED)
 * -----------------------------------------------------
 * FIX: strict literal typing for ExecutionItem.type
 */

import { predictHealthRisks } from "@/lib/prediction/riskPredictionEngine";
import { generateInterventions } from "@/lib/intervention/interventionDecisionEngine";
import { generateProactiveInterventions } from "@/lib/intervention/proactiveInterventionEngine";
import { updatePersonalityState } from "@/lib/personality/adaptivePersonalityEngine";

import type { Intervention } from "@/lib/intervention/interventionDecisionEngine";
import type { PersonalityState } from "@/lib/personality/adaptivePersonalityEngine";

/**
 * =========================
 * OUTPUT TYPE
 * =========================
 */
export type BrainOutput = {
  interventions: Intervention[];
  proactive: any[];
  personality: PersonalityState | null;
  predictions: any[];
  priorityQueue: ExecutionItem[];
};

/**
 * =========================
 * EXECUTION TYPE (IMPORTANT FIX)
 * =========================
 */
export type ExecutionItem = {
  type: "immediate" | "proactive";
  priority: number;
  domain: string;
  action: string;
  reason?: string;
};

/**
 * =========================
 * MAIN ENTRY
 * =========================
 */
export async function runAeonveraBrain(params: {
  state: any;
  memory: any;
  personality: PersonalityState | null;
  adaptiveWeights: any;
  engagementScore: number;
  userId: string;
}) {
  const {
    state,
    memory,
    personality,
    adaptiveWeights,
    engagementScore,
    userId,
  } = params;

  /**
   * =========================
   * STEP 1 — PREDICTIONS
   * =========================
   */
  const predictions = predictHealthRisks(state);

  /**
   * =========================
   * STEP 2 — IMMEDIATE INTERVENTIONS
   * =========================
   */
  const interventions = generateInterventions(
    state,
    predictions,
    adaptiveWeights,
    {
      memory,
      personality,
    }
  );

  /**
   * =========================
   * STEP 3 — PROACTIVE INTERVENTIONS
   * =========================
   */
  const proactive = generateProactiveInterventions({
    predictions,
    personality,
    memory,
  });

  /**
   * =========================
   * STEP 4 — PERSONALITY UPDATE
   * =========================
   */
  const updatedPersonality = await updatePersonalityState({
    userId,
    healthState: state,
    memory,
    recentCoachOutputs: interventions,
    engagementScore,
  });

  /**
   * =========================
   * STEP 5 — PRIORITY QUEUE (FIXED TYPES)
   * =========================
   */
  const immediate: ExecutionItem[] = interventions.map((i) => ({
    type: "immediate" as const,   // ✅ FIX HERE
    priority: i.priority,
    domain: i.domain,
    action: i.action,
    reason: i.reason,
  }));

  const early: ExecutionItem[] = proactive
    .filter((p) => p.decision !== "ignore")
    .map((p) => ({
      type: "proactive" as const,   // ✅ FIX HERE
      priority: p.urgency,
      domain: p.domain,
      action: p.decision,
      reason: p.reason,
    }));

  const priorityQueue: ExecutionItem[] = [...immediate, ...early].sort(
    (a, b) => b.priority - a.priority
  );

  return {
    interventions,
    proactive,
    personality: updatedPersonality,
    predictions,
    priorityQueue,
  };
}