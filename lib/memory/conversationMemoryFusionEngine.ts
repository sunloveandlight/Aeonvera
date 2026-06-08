/**
 * Aeonvera — Conversation Memory Fusion Engine (STEP 24)
 * ------------------------------------------------------
 * Builds a unified intelligence snapshot combining:
 * - coach outputs
 * - conversation history
 * - health state
 */

import { supabase } from "@/lib/supabase/client";

export type ConversationEvent = {
  userId: string;
  role: "user" | "assistant" | "system";
  message: string;
  tone?: string;
  linkedCoachOutputId?: string;
  timestamp: string;
};

export type UserMemorySnapshot = {
  userId: string;

  recentConversation: ConversationEvent[];
  recentCoachOutputs: any[];
  latestHealthState: any;

  dominantEmotionalTone: string;
  recurringTopics: string[];

  summary: string;

  updatedAt: string;
};

/**
 * MAIN ENTRY — builds fused memory snapshot
 */
export async function buildUserMemorySnapshot(userId: string) {
  const [conversation, coachOutputs, healthState] = await Promise.all([
    getConversation(userId),
    getCoachOutputs(userId),
    getLatestHealthState(userId),
  ]);

  const dominantTone = computeDominantTone(conversation);
  const topics = extractTopics(conversation, coachOutputs);

  const snapshot: UserMemorySnapshot = {
    userId,
    recentConversation: conversation,
    recentCoachOutputs: coachOutputs,
    latestHealthState: healthState,
    dominantEmotionalTone: dominantTone,
    recurringTopics: topics,
    summary: buildSummary(dominantTone, topics, healthState),
    updatedAt: new Date().toISOString(),
  };

  return snapshot;
}

/**
 * FETCH CONVERSATION HISTORY
 */
async function getConversation(userId: string): Promise<ConversationEvent[]> {
  const { data } = await supabase
    .from("conversation_events")
    .select("*")
    .eq("user_id", userId)
    .order("timestamp", { ascending: false })
    .limit(50);

  return (
    data?.map((d) => ({
      userId,
      role: d.role,
      message: d.message,
      tone: d.tone,
      linkedCoachOutputId: d.linked_coach_output_id,
      timestamp: d.timestamp,
    })) || []
  );
}

/**
 * FETCH COACH OUTPUTS
 */
async function getCoachOutputs(userId: string) {
  const { data } = await supabase
    .from("coach_outputs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  return data || [];
}

/**
 * FETCH HEALTH STATE
 */
async function getLatestHealthState(userId: string) {
  const { data } = await supabase
    .from("health_states")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  return data || null;
}

/**
 * TONE ANALYSIS
 */
function computeDominantTone(conversation: ConversationEvent[]) {
  const tones = conversation.map((c) => c.tone).filter(Boolean);

  if (tones.length === 0) return "neutral";

  const frequency: Record<string, number> = {};

  for (const t of tones) {
    frequency[t!] = (frequency[t!] || 0) + 1;
  }

  return Object.entries(frequency).sort(
    (a, b) => b[1] - a[1]
  )[0][0];
}

/**
 * TOPIC EXTRACTION (simple V1)
 */
function extractTopics(
  conversation: ConversationEvent[],
  coachOutputs: any[]
) {
  const keywords = new Set<string>();

  for (const c of conversation) {
    if (c.message.includes("sleep")) keywords.add("sleep");
    if (c.message.includes("energy")) keywords.add("energy");
    if (c.message.includes("stress")) keywords.add("stress");
    if (c.message.includes("workout")) keywords.add("activity");
  }

  for (const c of coachOutputs) {
    if (c.message?.includes("Sleep")) keywords.add("sleep");
    if (c.message?.includes("Recovery")) keywords.add("recovery");
    if (c.message?.includes("activity")) keywords.add("activity");
  }

  return Array.from(keywords);
}

/**
 * SUMMARY BUILDER
 */
function buildSummary(
  tone: string,
  topics: string[],
  healthState: any
) {
  return `
User shows a ${tone} emotional tone.
Key focus areas: ${topics.join(", ") || "none detected"}.
Latest health state indicates:
- Sleep risk: ${healthState?.state?.riskScores?.sleep ?? "unknown"}
- Activity risk: ${healthState?.state?.riskScores?.activity ?? "unknown"}
  `.trim();
}