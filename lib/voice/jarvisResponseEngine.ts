import type { CoachTrigger, CoachMode } from "@/lib/types/coachTypes";
import type { Intervention } from "@/lib/intervention/interventionDecisionEngine";

export type JarvisMessage = {
  mode: CoachMode;
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

  if (trigger.intensity === "silent" || !trigger.shouldTrigger) {
    return {
      mode: "silent",
      tone: "neutral",
      message: "",
      actions: [],
    };
  }

  const top = interventions[0];
  const tone = selectTone(trigger.intensity, top?.domain);
  const message = buildMessage({ tone, trigger, interventions, userName });
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
}) {
  const { tone, interventions, userName } = params;
  const name = userName ? `${userName}, ` : "";
  const top = interventions[0];

  switch (tone) {
    case "urgent":
      return `${name}Critical pattern detected in ${top?.domain}. Immediate attention required. ${top?.reason || ""}`;
    case "direct":
      if (top?.domain === "activity" && /execution|skipped|scheduled|score/i.test(top.reason || "")) {
        return `${name}${top.reason} Today I recommend: ${top.action}`;
      }
      return `${name}Focus area: ${top?.domain}. ${top?.reason}.`;
    case "supportive":
      return `${name}I'm seeing stress in ${top?.domain}, but nothing critical.`;
    default:
      if (/execution|skipped|scheduled|score/i.test(top?.reason || "")) {
        return `${name}${top?.reason} Next step: ${top?.action}`;
      }
      return `${name}Current optimization focus: ${top?.domain}.`;
  }
}
