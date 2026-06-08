/**
 * Aeonvera — Coaching Runtime Engine (STEP 25 FINAL ARCHITECTURE FIX)
 * --------------------------------------------------------------------
 * FIXES:
 * - TS2353 personality injection error
 * - Removes unsafe mixed context passing
 * - Introduces unified RuntimeContextBundle
 * - Fully future-proof for memory + personality + interventions
 */

import { evaluateCoachTrigger } from "@/lib/coach/triggerEngine";
import { generateInterventions } from "@/lib/intervention/interventionDecisionEngine";
import { generateJarvisMessage } from "@/lib/voice/jarvisResponseEngine";
import { storeCoachOutput } from "@/lib/memory/coachOutputMemoryEngine";
import { buildUserMemorySnapshot } from "@/lib/memory/conversationMemoryFusionEngine";
import { updatePersonalityState } from "@/lib/personality/adaptivePersonalityEngine";

/**
 * =========================
 * CORE TYPES (NEW FIX)
 * =========================
 */

export type RuntimeSource =
  | "runtime"
  | "cron"
  | "assessment"
  | "system";

export type RuntimeContextBundle = {
  state: any;
  predictions: any;
  adaptiveWeights: any;

  timeOfDay: number;
  lastInteractionMinutesAgo: number;
  engagementScore: number;

  userId?: string;
  source?: RuntimeSource;

  /**
   * =========================
   * MEMORY LAYER (OPTIONAL)
   * =========================
   */
  memory?: any;

  /**
   * =========================
   * PERSONALITY LAYER (OPTIONAL)
   * =========================
   */
  personality?: any;
};

export type RuntimeResult = {
  triggered: boolean;
  mode: "silent" | "dashboard" | "notification" | "conversation";
  message?: string;
  actions?: string[];
};

/**
 * =========================
 * MAIN ENTRY
 * =========================
 */
export async function runCoachRuntime(
  ctx: RuntimeContextBundle
): Promise<RuntimeResult> {
  const {
    state,
    predictions,
    adaptiveWeights,
    timeOfDay,
    lastInteractionMinutesAgo,
    engagementScore,
    userId,
    source = "runtime",
  } = ctx;

  /**
   * =========================
   * STEP 0 — MEMORY FUSION
   * =========================
   */
  let memory = ctx.memory ?? null;

  if (!memory && userId) {
    try {
      memory = await buildUserMemorySnapshot(userId);
    } catch (err) {
      console.error("[Memory Fusion Failed]", err);
      memory = null;
    }
  }

  /**
   * =========================
   * STEP 0.5 — PERSONALITY ENGINE
   * =========================
   */
  let personality = ctx.personality ?? null;

  if (!personality && userId) {
    try {
      personality = await updatePersonalityState({
        userId,
        healthState: state,
        memory,
        recentCoachOutputs: [],
        engagementScore,
      });
    } catch (err) {
      console.error("[Personality Update Failed]", err);
      personality = null;
    }
  }

  /**
   * =========================
   * STEP 1 — INTERVENTIONS
   * =========================
   */
  let interventions: any[] = [];

  try {
    interventions = generateInterventions(
      state,
      predictions,
      adaptiveWeights,
      {
        memory,
        personality,
      }
    );
  } catch (err) {
    console.error("[Intervention Engine Failed]", err);

    // fallback safe mode
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
   * =========================
   * STEP 2 — TRIGGER ENGINE
   * =========================
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
   * =========================
   * STEP 3 — JARVIS RESPONSE
   * =========================
   */
  const jarvis = generateJarvisMessage({
    trigger,
    interventions: trigger.selectedInterventions,
  });

  /**
   * =========================
   * STEP 4 — PERSIST OUTPUT
   * =========================
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
      console.error("[Coach Output Persistence Failed]", err);
    }
  }

  /**
   * =========================
   * STEP 5 — RETURN RESULT
   * =========================
   */
  return {
    triggered: true,
    mode: jarvis.mode,
    message: jarvis.message,
    actions: jarvis.actions,
  };
}