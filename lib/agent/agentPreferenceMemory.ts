import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getHealthSubjectFilter,
  type ActiveHealthProfileContext,
} from "@/lib/health-profiles/activeHealthProfile";

export type AgentPreferenceMemory = {
  avoidMorningTraining: boolean;
  coachingTone: "balanced" | "direct" | "supportive";
  preferredLoad: "light" | "steady" | "ambitious";
  reminderWindow: "morning" | "afternoon" | "evening" | "after_lunch" | "after_dinner" | null;
  trainingTime: "morning" | "later" | null;
  raw: Array<{
    category?: string | null;
    confidence?: number | null;
    preference_key?: string | null;
    preference_value?: string | null;
  }>;
};

export async function getAgentPreferenceMemory({
  supabase,
  userId,
  healthProfileContext,
}: {
  supabase: SupabaseClient;
  userId: string;
  healthProfileContext?: ActiveHealthProfileContext | null;
}): Promise<AgentPreferenceMemory> {
  const filter = healthProfileContext
    ? getHealthSubjectFilter(healthProfileContext)
    : { column: "user_id" as const, value: userId };
  const { data, error } = await supabase
    .from("agent_preferences")
    .select("category,preference_key,preference_value,confidence,updated_at")
    .eq(filter.column, filter.value)
    .order("updated_at", { ascending: false })
    .limit(40);

  if (error) {
    if (isMissingAgentPreferenceTable(error)) return defaultAgentPreferenceMemory();
    console.error("[Agent Preference Memory Error]", error.message);
    return defaultAgentPreferenceMemory();
  }

  return buildAgentPreferenceMemory(data || []);
}

export function buildAgentPreferenceMemory(
  rows: AgentPreferenceMemory["raw"]
): AgentPreferenceMemory {
  const memory = defaultAgentPreferenceMemory();
  memory.raw = rows;

  for (const row of rows) {
    const key = normalize(row.preference_key);
    const value = normalize(row.preference_value);
    const confidence = Number(row.confidence ?? 0.7);
    if (confidence < 0.45) continue;

    if (key === "avoid_morning_training" || value.includes("avoid scheduling training blocks in the morning")) {
      memory.avoidMorningTraining = true;
    }

    if (key === "training_time") {
      if (value.includes("morning")) memory.trainingTime = "morning";
      if (value.includes("later") || value.includes("evening") || value.includes("day")) {
        memory.trainingTime = "later";
      }
    }

    if (key === "preferred_load") {
      if (/(fewer|lighter|simpler|essential|less)/.test(value)) memory.preferredLoad = "light";
      if (/(ambitious|more|intense|push)/.test(value)) memory.preferredLoad = "ambitious";
    }

    if (key === "coaching_tone") {
      if (/(direct|accountability|hard truth|strict)/.test(value)) memory.coachingTone = "direct";
      if (/(calm|supportive|gentle|encouraging|soft)/.test(value)) {
        memory.coachingTone = "supportive";
      }
    }

    if (key === "preferred_reminder_window") {
      if (value.includes("after lunch")) memory.reminderWindow = "after_lunch";
      else if (value.includes("after dinner")) memory.reminderWindow = "after_dinner";
      else if (/(evening|night|later)/.test(value)) memory.reminderWindow = "evening";
      else if (/(morning|am)/.test(value)) memory.reminderWindow = "morning";
      else if (/(lunch|afternoon)/.test(value)) memory.reminderWindow = "afternoon";
    }
  }

  if (memory.avoidMorningTraining && memory.trainingTime === "morning") {
    memory.trainingTime = "later";
  }

  return memory;
}

export function defaultAgentPreferenceMemory(): AgentPreferenceMemory {
  return {
    avoidMorningTraining: false,
    coachingTone: "balanced",
    preferredLoad: "steady",
    reminderWindow: null,
    trainingTime: null,
    raw: [],
  };
}

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isMissingAgentPreferenceTable(error: { code?: string; message?: string }) {
  return (
    error.code === "PGRST205" ||
    error.message?.includes("agent_preferences") ||
    error.message?.includes("schema cache")
  );
}
