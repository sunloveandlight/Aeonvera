/**
 * Aeonvera — J.A.R.V.I.S. Response Engine (V1)
 * -------------------------------------------
 * Converts structured interventions into natural conversational output.
 */

import { Intervention } from "@/lib/intervention/interventionDecisionEngine";
import { CoachTrigger } from "@/lib/coach/triggerEngine";

export type JarvisMessage = {
  mode: "silent" | "dashboard" | "notification" | "conversation";
  tone: "neutral" | "supportive" | "direct" | "urgent";
  message: string;
  actions: string[];
};

/**
 * MAIN ENTRY
 */
export function generateJarvisMessage(params: {
  trigger: CoachTrigger;
  interventions: Intervention[];
  userName?: string;
}): JarvisMessage {
  const { trigger, interventions, userName } = params;

  if (!trigger.shouldTrigger) {
    return {
      mode: "silent",
      tone: "neutral",
      message: "",
      actions: [],
    };
  }

  const top = interventions[0];

  const tone = selectTone(trigger.intensity, top?.domain);

  const message = buildMessage({
    tone,
    trigger,
    interventions,
    userName,
  });

  const actions = interventions.slice(0, 3).map((i) => i.action);

  return {
    mode: trigger.mode,
    tone,
    message,
    actions,
  };
}

/**
 * TONE ENGINE
 */
function selectTone(
  intensity: CoachTrigger["intensity"],
  domain?: string
): JarvisMessage["tone"] {
  if (intensity === "high") return "urgent";
  if (intensity === "medium") return "direct";

  if (domain === "sleep") return "supportive";

  return "neutral";
}

/**
 * MESSAGE BUILDER
 */
function buildMessage(params: {
  tone: JarvisMessage["tone"];
  trigger: CoachTrigger;
  interventions: Intervention[];
  userName?: string;
}): string {
  const { tone, trigger, interventions, userName } = params;

  const name = userName ? `${userName}, ` : "";

  const top = interventions[0];

  switch (tone) {
    case "urgent":
      return `${name}I’m seeing a significant risk pattern in your ${top?.domain} system. This needs attention now. ${
        top?.reason || ""
      }`;

    case "direct":
      return `${name}Your current priority is ${top?.domain}. ${top?.reason}. I recommend we address this first.`;

    case "supportive":
      return `${name}I’m noticing a pattern in your ${top?.domain}. Nothing critical, but improving this will noticeably help your recovery.`;

    case "neutral":
    default:
      return `${name}Here’s your current optimization focus: ${top?.domain}.`;
  }
}