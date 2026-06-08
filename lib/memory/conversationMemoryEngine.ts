/**
 * Aeonvera — Conversation Memory Engine (V1)
 * ------------------------------------------
 * Stores and retrieves conversational context for continuity.
 */

export type ConversationEvent = {
  userId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  tags?: string[];
};

export type ConversationMemory = {
  recentSummary: string;
  keyTopics: string[];
  recurringIssues: string[];
  lastEmotionalTone: "positive" | "neutral" | "negative";
};

/**
 * MAIN ENTRY
 */
export function buildConversationMemory(
  events: ConversationEvent[]
): ConversationMemory {
  if (!events.length) {
    return {
      recentSummary: "",
      keyTopics: [],
      recurringIssues: [],
      lastEmotionalTone: "neutral",
    };
  }

  const recent = events.slice(-20);

  return {
    recentSummary: summarizeRecent(recent),
    keyTopics: extractTopics(recent),
    recurringIssues: detectRecurringIssues(events),
    lastEmotionalTone: detectEmotion(recent),
  };
}

/**
 * SIMPLE SUMMARY ENGINE
 */
function summarizeRecent(events: ConversationEvent[]): string {
  return events
    .map((e) => `${e.role}: ${e.content}`)
    .slice(-5)
    .join(" | ");
}

/**
 * TOPIC EXTRACTION (V1 heuristic)
 */
function extractTopics(events: ConversationEvent[]): string[] {
  const topics = new Set<string>();

  for (const e of events) {
    const text = e.content.toLowerCase();

    if (text.includes("sleep")) topics.add("sleep");
    if (text.includes("stress")) topics.add("stress");
    if (text.includes("training") || text.includes("exercise"))
      topics.add("activity");
    if (text.includes("diet") || text.includes("food"))
      topics.add("nutrition");
    if (text.includes("tired")) topics.add("fatigue");
  }

  return Array.from(topics);
}

/**
 * PATTERN DETECTION
 */
function detectRecurringIssues(events: ConversationEvent[]): string[] {
  const issues: Record<string, number> = {};

  for (const e of events) {
    const text = e.content.toLowerCase();

    if (text.includes("can't sleep")) issues["insomnia"] = (issues["insomnia"] || 0) + 1;
    if (text.includes("low energy")) issues["fatigue"] = (issues["fatigue"] || 0) + 1;
    if (text.includes("stressed")) issues["stress"] = (issues["stress"] || 0) + 1;
  }

  return Object.entries(issues)
    .filter(([, count]) => count >= 2)
    .map(([issue]) => issue);
}

/**
 * EMOTION SIGNAL (V1 heuristic)
 */
function detectEmotion(events: ConversationEvent[]): "positive" | "neutral" | "negative" {
  const last = events.slice(-5);

  let score = 0;

  for (const e of last) {
    const text = e.content.toLowerCase();

    if (text.includes("good") || text.includes("better")) score++;
    if (text.includes("bad") || text.includes("worse")) score--;
    if (text.includes("tired") || text.includes("stressed")) score--;
  }

  if (score > 1) return "positive";
  if (score < -1) return "negative";
  return "neutral";
}