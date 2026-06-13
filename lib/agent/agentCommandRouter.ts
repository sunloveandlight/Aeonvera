import type { SupabaseClient } from "@supabase/supabase-js";

type AgentAction = {
  type: string;
  label: string;
  detail: string;
  command?: Record<string, unknown>;
};

type PreferenceCategory =
  | "schedule_preference"
  | "avoidance"
  | "motivation"
  | "notification_timing"
  | "plan_intensity"
  | "reschedule_intent"
  | "general";

type PreferenceCandidate = {
  category: PreferenceCategory;
  key: string;
  value: string;
  confidence: number;
};

export async function processAgentCommand({
  question,
  source,
  supabase,
  userId,
}: {
  question: string;
  source: "agent_chat" | "mobile";
  supabase: SupabaseClient;
  userId: string;
}): Promise<{ actions: AgentAction[]; preferences: PreferenceCandidate[] }> {
  const actions = detectAgentActions(question);
  const preferences = detectPreferences(question);

  if (preferences.length) {
    await savePreferences({ preferences, source, supabase, userId });
  }

  return { actions, preferences };
}

export async function buildAgentSourcePrompts({
  supabase,
  userId,
}: {
  supabase: SupabaseClient;
  userId: string;
}) {
  const [wearableResult, labResult] = await Promise.all([
    supabase
      .from("wearable_metrics")
      .select("provider,recorded_at")
      .eq("user_id", userId)
      .order("recorded_at", { ascending: false })
      .limit(12),
    supabase
      .from("lab_biomarkers")
      .select("canonical_key,measured_at")
      .eq("user_id", userId)
      .order("measured_at", { ascending: false })
      .limit(32),
  ]);

  const prompts: string[] = [];
  const wearableRows = wearableResult.error ? [] : wearableResult.data || [];
  const labRows = labResult.error ? [] : labResult.data || [];
  const latestWearableAt = latestDate(wearableRows.map((row) => row.recorded_at));
  const labKeys = new Set(labRows.map((row) => row.canonical_key).filter(Boolean));

  if (!wearableRows.length) {
    prompts.push("Do you want me to help connect Oura or import Apple Health?");
  } else if (latestWearableAt && daysSince(latestWearableAt) > 7) {
    prompts.push("Your wearable signal looks stale. Should we refresh Oura or Apple Health?");
  }

  const missingLabs = ["apob", "hba1c", "fasting_insulin", "hscrp", "vitamin_d"].filter(
    (key) => !labKeys.has(key)
  );

  if (missingLabs.length) {
    prompts.push(`Do you have ${formatLabName(missingLabs[0])} available from your labs?`);
  }

  return prompts.slice(0, 2);
}

function detectAgentActions(question: string): AgentAction[] {
  const text = normalize(question);
  const actions: AgentAction[] = [];

  if (/\b(prepare|build|create|make)\b.*\b(today|daily|day)\b.*\b(plan|protocol|schedule)\b/.test(text)) {
    actions.push({
      type: "prepare_today",
      label: "Daily plan prepared",
      detail: "Aeonvera will refresh today's plan and bring it into focus.",
      command: { target: "today", operation: "prepare_daily_plan" },
    });
  }

  if (/\b(remind|notify|notification)\b.*\b(later|tonight|tomorrow|after lunch|after dinner)\b/.test(text)) {
    const preset = text.includes("tomorrow") ? "tomorrow" : "soon";
    actions.push({
      type: "schedule_later",
      label: "Reminder intent captured",
      detail: preset === "tomorrow"
        ? "Aeonvera recognized that this should become a reminder tomorrow."
        : "Aeonvera recognized that this should become a timed reminder.",
      command: { target: "today", operation: "schedule_later", preset },
    });
  }

  if (/\b(move|reschedule|shift)\b.*\b(workout|training|walk|cardio|zone 2|strength)\b.*\b(tomorrow|later|tonight)\b/.test(text)) {
    actions.push({
      type: "reschedule_training",
      label: "Training reschedule intent",
      detail: "Aeonvera recognized a training reschedule request and will move the next training block.",
      command: { target: "today", operation: "reschedule_training", preset: "tomorrow" },
    });
  }

  if (/\b(source|data|oura|apple health|labs?|biomarker|wearable|hrv)\b.*\b(missing|stale|refresh|sync|import|connect|update)\b/.test(text)) {
    const provider = text.includes("oura")
      ? "oura"
      : text.includes("whoop")
        ? "whoop"
        : text.includes("apple health")
          ? "apple_health"
          : undefined;
    actions.push({
      type: "open_data_sources",
      label: "Source check opened",
      detail: "Aeonvera recognized a data-source request.",
      command: { target: "data_sources", operation: provider ? "sync" : "open", provider },
    });
  }

  if (/\b(what do you know|remember about me|memory|learned about me)\b/.test(text)) {
    actions.push({
      type: "open_memory",
      label: "Memory opened",
      detail: "Aeonvera recognized a request to review personal memory.",
      command: { target: "memory", operation: "open" },
    });
  }

  return dedupeActions(actions);
}

function detectPreferences(question: string): PreferenceCandidate[] {
  const text = normalize(question);
  const preferences: PreferenceCandidate[] = [];

  if (/\b(don't|do not|avoid|stop)\b.*\b(morning|am)\b.*\b(workout|training|exercise|cardio|strength)\b/.test(text)) {
    preferences.push({
      category: "avoidance",
      key: "avoid_morning_training",
      value: "Avoid scheduling training blocks in the morning.",
      confidence: 0.86,
    });
  }

  if (/\b(prefer|like|best)\b.*\b(morning|am)\b.*\b(workout|training|exercise|cardio|strength)\b/.test(text)) {
    preferences.push({
      category: "schedule_preference",
      key: "training_time",
      value: "Prefers training blocks in the morning.",
      confidence: 0.82,
    });
  }

  if (/\b(prefer|like|best)\b.*\b(evening|night|pm)\b.*\b(workout|training|exercise|cardio|strength)\b/.test(text)) {
    preferences.push({
      category: "schedule_preference",
      key: "training_time",
      value: "Prefers training blocks later in the day.",
      confidence: 0.82,
    });
  }

  if (/\b(too much|overwhelming|less|lighter|simpler|simplify)\b.*\b(plan|protocol|tasks?|actions?)\b/.test(text)) {
    preferences.push({
      category: "plan_intensity",
      key: "preferred_load",
      value: "Prefers fewer, higher-leverage actions.",
      confidence: 0.84,
    });
  }

  if (/\b(push me|hold me accountable|hard truth|direct|strict)\b/.test(text)) {
    preferences.push({
      category: "motivation",
      key: "coaching_tone",
      value: "Responds to direct accountability.",
      confidence: 0.78,
    });
  }

  if (/\b(gentle|encouraging|soft|supportive)\b.*\b(coach|tone|talk|message)\b/.test(text)) {
    preferences.push({
      category: "motivation",
      key: "coaching_tone",
      value: "Responds to calm, supportive coaching.",
      confidence: 0.78,
    });
  }

  if (/\b(remind|notify|message)\b.*\b(morning|am|evening|night|after lunch|after dinner)\b/.test(text)) {
    preferences.push({
      category: "notification_timing",
      key: "preferred_reminder_window",
      value: extractReminderPreference(text),
      confidence: 0.75,
    });
  }

  return dedupePreferences(preferences);
}

async function savePreferences({
  preferences,
  source,
  supabase,
  userId,
}: {
  preferences: PreferenceCandidate[];
  source: "agent_chat" | "mobile";
  supabase: SupabaseClient;
  userId: string;
}) {
  const rows = preferences.map((preference) => ({
    user_id: userId,
    category: preference.category,
    preference_key: preference.key,
    preference_value: preference.value,
    source,
    confidence: preference.confidence,
    metadata: {
      learned_from: source,
      updated_reason: "agent_command_router",
    },
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("agent_preferences")
    .upsert(rows, { onConflict: "user_id,category,preference_key" });

  if (error && !isMissingAgentPreferencesTable(error)) {
    console.error("[Agent Preference Store Error]", error.message);
  }
}

function extractReminderPreference(text: string) {
  if (text.includes("after lunch")) return "Prefers reminders after lunch.";
  if (text.includes("after dinner")) return "Prefers reminders after dinner.";
  if (/\b(evening|night|pm)\b/.test(text)) return "Prefers reminders later in the day.";
  if (/\b(morning|am)\b/.test(text)) return "Prefers reminders in the morning.";
  return "Prefers contextual reminders.";
}

function dedupeActions(actions: AgentAction[]) {
  return Array.from(new Map(actions.map((action) => [action.type, action])).values()).slice(0, 4);
}

function dedupePreferences(preferences: PreferenceCandidate[]) {
  return Array.from(
    new Map(preferences.map((preference) => [`${preference.category}:${preference.key}`, preference])).values()
  ).slice(0, 5);
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function latestDate(values: Array<string | null | undefined>) {
  return (
    values
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null
  );
}

function daysSince(value: string) {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return Number.POSITIVE_INFINITY;
  return (Date.now() - timestamp) / 86400000;
}

function formatLabName(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace("Apob", "ApoB")
    .replace("Hba1c", "HbA1c")
    .replace("Hscrp", "hsCRP");
}

function isMissingAgentPreferencesTable(error: { message?: string; code?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message?.includes("agent_preferences") ||
    error.message?.includes("schema cache")
  );
}
