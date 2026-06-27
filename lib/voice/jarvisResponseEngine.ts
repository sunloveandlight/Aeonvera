import type { CoachTrigger, CoachMode } from "@/lib/types/coachTypes";

export type Intervention = {
  domain: string;
  action: string;
  reason?: string;
  priority: number;
};

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
  preferredTone?: "encouraging" | "accountability" | "direct" | "balanced";
  memoryBrief?: string;
}): JarvisMessage {
  const { trigger, interventions, userName, preferredTone, memoryBrief } = params;

  if (trigger.intensity === "silent" || !trigger.shouldTrigger) {
    return {
      mode: "silent",
      tone: "neutral",
      message: "",
      actions: [],
    };
  }

  const top = interventions[0];
  const tone = selectTone(trigger.intensity, top?.domain, preferredTone);
  const message = buildMessage({ tone, trigger, interventions, userName, preferredTone, memoryBrief });
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
  domain?: string,
  preferredTone?: "encouraging" | "accountability" | "direct" | "balanced"
): JarvisMessage["tone"] {
  if (intensity === "high") return "urgent";
  if (preferredTone === "encouraging") return "supportive";
  if (preferredTone === "accountability" || preferredTone === "direct") return "direct";
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
  preferredTone?: "encouraging" | "accountability" | "direct" | "balanced";
  memoryBrief?: string;
}) {
  const { tone, interventions, userName, preferredTone, memoryBrief } = params;
  const name = userName ? `${userName}, ` : "";
  const top = interventions[0];
  const learnedContext = memoryBrief ? `${memoryBrief} ` : "";

  switch (tone) {
    case "urgent":
      return `${name}Critical pattern detected in ${top?.domain}. Immediate attention required. ${top?.reason || ""}`;
    case "direct":
      if (preferredTone === "accountability") {
        return `${name}${learnedContext}Today's commitment: ${top?.action}. Keep it small, complete it, and mark the result.`;
      }
      if (top?.domain === "activity" && /execution|skipped|scheduled|score/i.test(top.reason || "")) {
        return `${name}${top.reason} Today I recommend: ${top.action}`;
      }
      return `${name}Focus area: ${top?.domain}. ${top?.reason}.`;
    case "supportive":
      return `${name}${learnedContext || `I'm seeing stress in ${top?.domain}, but nothing critical.`} Next best step: ${top?.action}.`;
    default:
      if (/execution|skipped|scheduled|score/i.test(top?.reason || "")) {
        return `${name}${top?.reason} Next step: ${top?.action}`;
      }
      return `${name}${learnedContext || `Current optimization focus: ${top?.domain}.`}`;
  }
}
