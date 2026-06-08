import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type ConversationEvent = {
  userId: string;
  role: "user" | "assistant" | "system";
  content: string;
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
  const supabase = getSupabaseAdmin();

  const [conversation, coachOutputs, healthState] = await Promise.all([
    getConversation(supabase, userId),
    getCoachOutputs(supabase, userId),
    getLatestHealthState(supabase, userId),
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
 * FIXED: maps `content` field correctly (was `message`)
 */
async function getConversation(
  supabase: ReturnType<typeof import("@/lib/supabase/admin").getSupabaseAdmin>,
  userId: string
): Promise<ConversationEvent[]> {
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
      content: d.content,
      tone: d.tone,
      linkedCoachOutputId: d.linked_coach_output_id,
      timestamp: d.timestamp,
    })) || []
  );
}

/**
 * FETCH COACH OUTPUTS
 */
async function getCoachOutputs(
  supabase: ReturnType<typeof import("@/lib/supabase/admin").getSupabaseAdmin>,
  userId: string
) {
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
async function getLatestHealthState(
  supabase: ReturnType<typeof import("@/lib/supabase/admin").getSupabaseAdmin>,
  userId: string
) {
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

  return Object.entries(frequency).sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * TOPIC EXTRACTION
 * FIXED: uses `content` instead of `message`
 */
function extractTopics(
  conversation: ConversationEvent[],
  coachOutputs: any[]
) {
  const keywords = new Set<string>();

  for (const c of conversation) {
    if (c.content.includes("sleep")) keywords.add("sleep");
    if (c.content.includes("energy")) keywords.add("energy");
    if (c.content.includes("stress")) keywords.add("stress");
    if (c.content.includes("workout")) keywords.add("activity");
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
- Sleep risk: ${healthState?.risk_scores?.sleep ?? "unknown"}
- Activity risk: ${healthState?.risk_scores?.activity ?? "unknown"}
  `.trim();
}