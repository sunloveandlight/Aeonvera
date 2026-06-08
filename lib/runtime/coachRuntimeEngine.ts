/**
 * Aeonvera — Coaching Runtime Engine (STEP 23 UPDATED)
 * ----------------------------------------------------
 * Now persists ALL JARVIS outputs into system memory.
 */

import { evaluateCoachTrigger } from "@/lib/coach/triggerEngine";
import { generateInterventions } from "@/lib/intervention/interventionDecisionEngine";
import { generateJarvisMessage } from "@/lib/voice/jarvisResponseEngine";
import { storeCoachOutput } from "@/lib/memory/coachOutputMemoryEngine";

export type RuntimeResult = {
  triggered: boolean;
  mode: "silent" | "dashboard" | "notification" | "conversation";
  message?: string;
  actions?: string[];
};

/**
 * MAIN ENTRY — CORE BRAIN LOOP
 */
export async function runCoachRuntime(params: {
  state: any;
  predictions: any;
  adaptiveWeights: any;
  timeOfDay: number;
  lastInteractionMinutesAgo: number;
  engagementScore: number;
  userId?: string;
  source?: "runtime" | "cron" | "assessment" | "system";
}) {
  const {
    state,
    predictions,
    adaptiveWeights,
    timeOfDay,
    lastInteractionMinutesAgo,
    engagementScore,
    userId,
    source = "runtime",
  } = params;

  /**
   * STEP 1 — INTERVENTIONS
   */
  const interventions = generateInterventions(
    state,
    predictions,
    adaptiveWeights
  );

  if (!interventions.length) {
    return {
      triggered: false,
      mode: "silent",
    };
  }

  /**
   * STEP 2 — TRIGGER EVALUATION
   */
  const trigger = evaluateCoachTrigger({
    state,
    interventions,
    timeOfDay,
    lastInteractionMinutesAgo,
    userEngagementScore: engagementScore,
  });

  if (!trigger.shouldTrigger) {
    return {
      triggered: false,
      mode: "silent",
    };
  }

  /**
   * STEP 3 — JARVIS MESSAGE
   */
  const jarvis = generateJarvisMessage({
    trigger,
    interventions: trigger.selectedInterventions,
  });

  /**
   * STEP 4 — PERSIST OUTPUT (NEW)
   */
  if (userId) {
    await storeCoachOutput({
      userId,
      mode: jarvis.mode,
      tone: jarvis.tone,
      message: jarvis.message,
      actions: jarvis.actions,
      source,
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * STEP 5 — OUTPUT
   */
  return {
    triggered: true,
    mode: jarvis.mode,
    message: jarvis.message,
    actions: jarvis.actions,
  };
}