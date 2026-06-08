/**
 * Aeonvera — Language Modulation Engine (STEP 26)
 * ------------------------------------------------
 * Converts structured AI intent into adaptive communication style
 * based on personality + risk + emotional context
 */

export type ModulationContext = {
  personality: {
    strictness: number;
    empathy: number;
    proactivity: number;
  };

  state: {
    riskScores?: {
      sleep?: number;
      recovery?: number;
      activity?: number;
    };
  };

  memory?: {
    dominantEmotionalTone?: string;
  };
};

export type ModulatedMessage = {
  tone: "strict" | "balanced" | "empathetic";
  message: string;
};

/**
 * MAIN ENTRY
 */
export function modulateMessage(params: {
  domain: string;
  baseReason?: string;
  context: ModulationContext;
}): ModulatedMessage {
  const { domain, baseReason, context } = params;

  const { personality, state, memory } = context;

  const risk =
    (state?.riskScores?.sleep ?? 0) +
    (state?.riskScores?.recovery ?? 0) +
    (state?.riskScores?.activity ?? 0);

  /**
   * =========================
   * TONE SELECTION ENGINE
   * =========================
   */
  let tone: ModulatedMessage["tone"] = "balanced";

  if (personality.strictness > 70 || risk > 140) {
    tone = "strict";
  } else if (
    personality.empathy > 70 ||
    memory?.dominantEmotionalTone === "negative"
  ) {
    tone = "empathetic";
  }

  /**
   * =========================
   * MESSAGE BUILDING
   * =========================
   */
  const message = buildMessage(tone, domain, baseReason);

  return {
    tone,
    message,
  };
}

/**
 * =========================
 * MESSAGE BUILDER
 * =========================
 */
function buildMessage(
  tone: ModulatedMessage["tone"],
  domain: string,
  baseReason?: string
): string {
  switch (tone) {
    case "strict":
      return `Critical ${domain} issue detected. ${baseReason ?? "Immediate action required."}`;

    case "empathetic":
      return `I’ve noticed a challenge in your ${domain}. ${baseReason ?? "I’m here to help you improve this gently."}`;

    case "balanced":
    default:
      return `${domain} needs attention. ${baseReason ?? "Let’s work on improving this."}`;
  }
}