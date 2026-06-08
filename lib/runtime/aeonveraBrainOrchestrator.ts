/**
 * Aeonvera — Unified Brain Orchestrator (STEP 32)
 * -----------------------------------------------
 * SINGLE ENTRY POINT FOR ALL AI DECISIONS
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
  priorityQueue: any[];
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
   * STEP 1 — PREDICTION LAYER
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
   * STEP 4 — PERSONALITY UPDATE (LEARNING LOOP)
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
   * STEP 5 — PRIORITY MERGE ENGINE
   * =========================
   */
  const priorityQueue = buildPriorityQueue(interventions, proactive);

  return {
    interventions,
    proactive,
    personality: updatedPersonality,
    predictions,
    priorityQueue,
  };
}

/**
 * =========================
 * PRIORITY ENGINE
 * =========================
 */
function buildPriorityQueue(
  interventions: Intervention[],
  proactive: any[]
) {
  const immediate = interventions.map((i) => ({
    type: "immediate",
    priority: i.priority,
    domain: i.domain,
    action: i.action,
    reason: i.reason,
  }));

  const early = proactive
    .filter((p) => p.decision !== "ignore")
    .map((p) => ({
      type: "proactive",
      priority: p.urgency,
      domain: p.domain,
      action: p.decision,
      reason: p.reason,
    }));

  return [...immediate, ...early].sort((a, b) => b.priority - a.priority);
}