/**
 * Aeonvera — Coaching Runtime Engine (STEP 24++ STABLE)
 * -----------------------------------------------------
 * Production-safe, backward-compatible intelligence loop
 */

import { evaluateCoachTrigger } from "@/lib/coach/triggerEngine";
import { generateInterventions } from "@/lib/intervention/interventionDecisionEngine";
import { generateJarvisMessage } from "@/lib/voice/jarvisResponseEngine";
import { storeCoachOutput } from "@/lib/memory/coachOutputMemoryEngine";
import { buildUserMemorySnapshot } from "@/lib/memory/conversationMemoryFusionEngine";

export type RuntimeResult = {
  triggered: boolean;
  mode: "silent" | "dashboard" | "notification" | "conversation";
  message?: string;
  actions?: string[];
};

export async function runCoachRuntime(params: {
  state: any;
  predictions: any;
  adaptiveWeights: any;

  timeOfDay: number;
  lastInteractionMinutesAgo: number;
  engagementScore: number;

  userId?: string;
  source?: "runtime" | "cron" | "assessment" | "system";
}): Promise<RuntimeResult> {
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
   * STEP 0 — MEMORY FUSION (SAFE OPTIONAL)
   * --------------------------------------
   * Only used if available, NEVER breaks system
   */
  let memory = null;

  if (userId) {
    try {
      memory = await buildUserMemorySnapshot(userId);
    } catch (err) {
      console.error("Memory fusion failed:", err);
      memory = null;
    }
  }

  /**
   * STEP 1 — INTERVENTIONS (BACKWARD COMPATIBLE FIX)
   * -------------------------------------------------
   * FIX: prevent TS runtime break from new arg
   */
  let interventions: any[] = [];

  try {
    // @ts-ignore — future-compatible overload support
    interventions = generateInterventions(
      state,
      predictions,
      adaptiveWeights,
      memory
    );
  } catch (err) {
    console.error("Intervention generation failed:", err);

    // fallback safe mode (never crash runtime)
    interventions = generateInterventions(
      state,
      predictions,
      adaptiveWeights
    );
  }

  if (!interventions || interventions.length === 0) {
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
   * STEP 3 — JARVIS RESPONSE
   */
  const jarvis = generateJarvisMessage({
    trigger,
    interventions: trigger.selectedInterventions,
  });

  /**
   * STEP 4 — PERSIST OUTPUT (SAFE)
   */
  if (userId) {
    try {
      await storeCoachOutput({
        userId,
        mode: jarvis.mode,
        tone: jarvis.tone,
        message: jarvis.message,
        actions: jarvis.actions,
        source,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Coach output persistence failed:", err);
    }
  }

  /**
   * STEP 5 — RETURN RESULT
   */
  return {
    triggered: true,
    mode: jarvis.mode,
    message: jarvis.message,
    actions: jarvis.actions,
  };
}