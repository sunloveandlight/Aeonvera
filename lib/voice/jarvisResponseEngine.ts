/**
 * Aeonvera — J.A.R.V.I.S Response Engine (STEP 27 FULL PIPELINE)
 * -------------------------------------------------------------
 * Now fully integrated with:
 * - personality
 * - memory
 * - language modulation engine
 */

import { modulateMessage } from "@/lib/voice/languageModulationEngine";
import type { Intervention } from "@/lib/intervention/interventionDecisionEngine";
import type { PersonalityState } from "@/lib/personality/adaptivePersonalityEngine";

export type CoachTrigger = {
  shouldTrigger: boolean;
  mode: "silent" | "dashboard" | "notification" | "conversation";
  intensity: "low" | "medium" | "high";
};

export type JarvisMessage = {
  mode: "silent" | "dashboard" | "notification" | "conversation";
  tone: "strict" | "balanced" | "empathetic";
  message: string;
  actions: string[];
};

export function generateJarvisMessage(params: {
  trigger: CoachTrigger;
  interventions: Intervention[];

  /**
   * STEP 27 ADDITIONS
   */
  personality?: PersonalityState | null;
  memory?: any;
  state?: any;
}): JarvisMessage {
  const { trigger, interventions, personality, memory, state } = params;

  if (!trigger.shouldTrigger) {
    return {
      mode: "silent",
      tone: "balanced",
      message: "",
      actions: [],
    };
  }

  const top = interventions[0];

  /**
   * =========================
   * BASE INTENT MESSAGE
   * =========================
   */
  const baseReason = top?.reason || "Optimization opportunity detected";

  /**
   * =========================
   * LANGUAGE MODULATION (STEP 26)
   * =========================
   */
  const modulated = modulateMessage({
    domain: top?.domain ?? "general",
    baseReason,
    context: {
      personality: {
        strictness: personality?.strictness ?? 50,
        empathy: personality?.empathy ?? 50,
        proactivity: personality?.proactivity ?? 50,
      },
      state: state ?? {},
      memory: memory ?? {},
    },
  });

  /**
   * =========================
   * ACTION EXTRACTION
   * =========================
   */
  const actions = interventions.slice(0, 3).map((i) => i.action);

  /**
   * =========================
   * FINAL OUTPUT
   * =========================
   */
  return {
    mode: trigger.mode,
    tone: modulated.tone,
    message: modulated.message,
    actions,
  };
}