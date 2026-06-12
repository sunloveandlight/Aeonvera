import OpenAI from "openai";
import { loadOrBuildCoachMemoryProfile } from "@/lib/memory/coachMemoryProfile";
import type { getSupabaseAdmin } from "@/lib/supabase/admin";

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

type AgentMessage = {
  role: "user" | "assistant";
  content: string;
};

type ProtocolAction = {
  domain?: string | null;
  action?: string | null;
  why?: string | null;
  cadence?: string | null;
  impact?: string | null;
};

type ProtocolRow = {
  id: string;
  summary?: string | null;
  focus_domains?: string[] | null;
  status?: string | null;
  protocol?: {
    summary?: string;
    primary_protocol?: ProtocolAction[];
    coach_message?: string;
  } | null;
  created_at?: string | null;
};

type DailyPlanRow = {
  id?: string | null;
  plan_date?: string | null;
  status?: string | null;
  autopilot_mode?: string | null;
  summary?: string | null;
  plan?: {
    items?: ProtocolAction[];
    memory?: Record<string, unknown>;
    principles?: string[];
  } | null;
  updated_at?: string | null;
};

type ExecutionRow = {
  domain?: string | null;
  action?: string | null;
  outcome?: string | null;
  success?: boolean | null;
  notes?: string | null;
  measured_at?: string | null;
  created_at?: string | null;
};

type CalendarRow = {
  title?: string | null;
  action?: string | null;
  action_scope?: string | null;
  recurrence?: string | null;
  scheduled_for?: string | null;
  status?: string | null;
};

type NotificationRow = {
  title?: string | null;
  message?: string | null;
  channel?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type PreferenceRow = {
  category?: string | null;
  preference_key?: string | null;
  preference_value?: string | null;
  confidence?: number | string | null;
  updated_at?: string | null;
};

type AgentAction = {
  type:
    | "plan_simplified"
    | "preference_saved"
    | "reschedule_requested"
    | "notification_preference_saved";
  label: string;
  detail: string;
};

type AgentContext = {
  memory: Awaited<ReturnType<typeof loadOrBuildCoachMemoryProfile>>;
  protocol: ProtocolRow | null;
  dailyPlan: DailyPlanRow | null;
  outcomes: ExecutionRow[];
  calendarEvents: CalendarRow[];
  notifications: NotificationRow[];
  preferences: PreferenceRow[];
};

let openaiClient: OpenAI | null = null;

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) return null;

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }

  return openaiClient;
}

export async function answerPersonalHealthAgent({
  history,
  question,
  supabase,
  userId,
}: {
  history: AgentMessage[];
  question: string;
  supabase: SupabaseAdmin;
  userId: string;
}) {
  const context = await loadAgentContext(supabase, userId);
  const actions = await applyAgentInstructions({ context, question, supabase, userId });
  const updatedContext = actions.length ? await loadAgentContext(supabase, userId) : context;
  const openai = getOpenAI();

  if (!openai) {
    return {
      actions,
      answer: buildFallbackAnswer(question, updatedContext, actions),
      mode: "fallback" as const,
      context: updatedContext,
    };
  }

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1",
      temperature: 0.35,
      max_tokens: 780,
      messages: [
        {
          role: "system",
          content:
            "You are Aeonvera, a premium personal health agent. Use only the supplied user context. Think like a proactive operating system for health: explain the signal, the decision, the tradeoff, and the next clean action. Be calm, precise, sophisticated, natural, and practical. If the user asks why something was scheduled, explain the evidence and the intended adaptation. If the plan feels too heavy, simplify it. Do not diagnose, prescribe medication, or claim certainty. Keep answers under 220 words unless the user asks for detail.",
        },
        {
          role: "user",
          content: `User context:\n${JSON.stringify(summarizeContext(updatedContext), null, 2)}\n\nActions already applied from this message:\n${JSON.stringify(actions, null, 2)}`,
        },
        ...history.slice(-6).map((message) => ({
          role: message.role,
          content: message.content,
        })),
        { role: "user" as const, content: question },
      ],
    });

    const answer = completion.choices[0]?.message?.content?.trim();

    if (answer) {
      return {
        actions,
        answer,
        mode: "generated" as const,
        context: updatedContext,
      };
    }
  } catch (error) {
    console.error(
      "[Personal Health Agent Error]",
      error instanceof Error ? error.message : error
    );
  }

  return {
    actions,
    answer: buildFallbackAnswer(question, updatedContext, actions),
    mode: "fallback" as const,
    context: updatedContext,
  };
}

async function loadAgentContext(
  supabase: SupabaseAdmin,
  userId: string
): Promise<AgentContext> {
  const today = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();

  const [memory, protocolRes, planRes, outcomesRes, calendarRes, notificationRes, preferenceRes] =
    await Promise.all([
      loadOrBuildCoachMemoryProfile(supabase, userId),
      safeQuery(() =>
        supabase
          .from("optimization_protocols")
          .select("id,summary,focus_domains,status,protocol,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ),
      safeQuery(() =>
        supabase
          .from("daily_execution_plans")
          .select("id,plan_date,status,autopilot_mode,summary,plan,updated_at")
          .eq("user_id", userId)
          .eq("plan_date", today)
          .maybeSingle()
      ),
      safeQuery(() =>
        supabase
          .from("intervention_outcomes")
          .select("domain,action,outcome,success,notes,measured_at,created_at")
          .eq("user_id", userId)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(24)
      ),
      safeQuery(() =>
        supabase
          .from("calendar_events")
          .select("title,action,action_scope,recurrence,scheduled_for,status")
          .eq("user_id", userId)
          .gte("scheduled_for", since)
          .order("scheduled_for", { ascending: false })
          .limit(18)
      ),
      safeQuery(() =>
        supabase
          .from("notification_deliveries")
          .select("title,message,channel,status,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(8)
      ),
      safeQuery(() =>
        supabase
          .from("agent_preferences")
          .select("category,preference_key,preference_value,confidence,updated_at")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .limit(20)
      ),
    ]);

  return {
    memory,
    protocol: (protocolRes.data as ProtocolRow | null) || null,
    dailyPlan: (planRes.data as DailyPlanRow | null) || null,
    outcomes: ((outcomesRes.data || []) as ExecutionRow[]).slice(0, 24),
    calendarEvents: ((calendarRes.data || []) as CalendarRow[]).slice(0, 18),
    notifications: ((notificationRes.data || []) as NotificationRow[]).slice(0, 8),
    preferences: ((preferenceRes.data || []) as PreferenceRow[]).slice(0, 20),
  };
}

async function applyAgentInstructions({
  context,
  question,
  supabase,
  userId,
}: {
  context: AgentContext;
  question: string;
  supabase: SupabaseAdmin;
  userId: string;
}): Promise<AgentAction[]> {
  const lower = question.toLowerCase();
  const actions: AgentAction[] = [];

  if (/(make|lighter|simpler|too much|overwhelming|less|reduce|easy)/.test(lower)) {
    const simplified = await simplifyDailyPlan({ context, supabase, userId });
    if (simplified) actions.push(simplified);

    const saved = await saveAgentPreference({
      category: "plan_intensity",
      confidence: 0.84,
      key: "prefers_lighter_daily_plan",
      metadata: { trigger: question },
      supabase,
      userId,
      value: "Prefer fewer, higher-leverage daily actions when the plan feels heavy.",
    });
    if (saved) actions.push(saved);
  }

  if (/(hate|don't like|do not like|avoid|never|not in the morning|morning workout|morning workouts|too early)/.test(lower)) {
    const value = /morning/.test(lower)
      ? "Avoid scheduling demanding workouts in the morning unless the user explicitly asks."
      : `User preference captured from agent chat: ${question.slice(0, 220)}`;
    const saved = await saveAgentPreference({
      category: /morning/.test(lower) ? "schedule_preference" : "avoidance",
      confidence: 0.82,
      key: /morning/.test(lower) ? "avoid_morning_training" : stablePreferenceKey(question),
      metadata: { trigger: question },
      supabase,
      userId,
      value,
    });
    if (saved) actions.push(saved);
  }

  if (/(after lunch|post lunch|afternoon|after noon|2 pm|2pm|3 pm|3pm)/.test(lower)) {
    const saved = await saveAgentPreference({
      category: "notification_timing",
      confidence: 0.8,
      key: "prefers_after_lunch_nudges",
      metadata: { trigger: question },
      supabase,
      userId,
      value: "Prefer reminders and nudges after lunch or early afternoon when possible.",
    });
    if (saved) {
      actions.push({
        ...saved,
        type: "notification_preference_saved",
      });
    }
  }

  if (/(move|reschedule|tomorrow|later|different time|not today)/.test(lower)) {
    const saved = await saveAgentPreference({
      category: "reschedule_intent",
      confidence: 0.72,
      key: stablePreferenceKey(question),
      metadata: {
        trigger: question,
        latest_calendar_action: context.calendarEvents[0]?.action || null,
      },
      supabase,
      userId,
      value: `Reschedule request captured: ${question.slice(0, 220)}`,
    });
    if (saved) {
      actions.push({
        type: "reschedule_requested",
        label: "Reschedule intent saved",
        detail:
          "Aeonvera saved the reschedule request. Device calendar changes still happen inside the mobile app so Apple/Android calendars stay accurate.",
      });
    }
  }

  return dedupeActions(actions);
}

async function simplifyDailyPlan({
  context,
  supabase,
  userId,
}: {
  context: AgentContext;
  supabase: SupabaseAdmin;
  userId: string;
}): Promise<AgentAction | null> {
  const items = context.dailyPlan?.plan?.items || [];
  if (!context.dailyPlan || items.length <= 2) return null;

  const simplifiedItems = [...items]
    .sort((a, b) => actionImportance(b) - actionImportance(a))
    .slice(0, 2);
  const nextPlan = {
    ...(context.dailyPlan.plan || {}),
    items: simplifiedItems,
    summary:
      "Aeonvera simplified today to the two highest-leverage actions so execution stays clean.",
    memory: {
      ...(context.dailyPlan.plan?.memory || {}),
      plan_load: "light",
      adjusted_by_agent: true,
      adjusted_at: new Date().toISOString(),
    },
  };

  const { error } = await supabase
    .from("daily_execution_plans")
    .update({
      status: "adjusted",
      summary: nextPlan.summary,
      plan: nextPlan,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("plan_date", context.dailyPlan.plan_date || new Date().toISOString().slice(0, 10));

  if (error) {
    if (isMissingTableError(error)) return null;
    throw new Error(error.message || "Could not simplify daily plan.");
  }

  return {
    type: "plan_simplified",
    label: "Today simplified",
    detail: "Aeonvera reduced today to the two highest-leverage actions.",
  };
}

async function saveAgentPreference({
  category,
  confidence,
  key,
  metadata,
  supabase,
  userId,
  value,
}: {
  category: string;
  confidence: number;
  key: string;
  metadata: Record<string, unknown>;
  supabase: SupabaseAdmin;
  userId: string;
  value: string;
}): Promise<AgentAction | null> {
  const { error } = await supabase.from("agent_preferences").upsert(
    {
      user_id: userId,
      category,
      preference_key: key,
      preference_value: value,
      source: "agent_chat",
      confidence,
      metadata,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,category,preference_key" }
  );

  if (error) {
    if (isMissingTableError(error) || error.message?.includes("agent_preferences")) {
      return null;
    }

    throw new Error(error.message || "Could not save agent preference.");
  }

  return {
    type: "preference_saved",
    label: "Preference remembered",
    detail: value,
  };
}

async function safeQuery<T>(
  query: () => PromiseLike<{ data: T | null; error: { code?: string; message?: string } | null }>
) {
  const result = await query();

  if (result.error) {
    if (isMissingTableError(result.error)) {
      return { data: null };
    }

    throw new Error(result.error.message || "Agent context query failed.");
  }

  return { data: result.data };
}

function summarizeContext(context: AgentContext) {
  return {
    memory: context.memory
      ? {
          communicationStyle: context.memory.communicationStyle,
          morningBrief: context.memory.morningBrief,
          motivationProfile: context.memory.motivationProfile,
          strongestInterventions: context.memory.bestInterventions.slice(0, 3),
          frictionPatterns: context.memory.failurePatterns.slice(0, 3),
          domainScores: context.memory.domainScores,
          confidence: context.memory.confidence,
        }
      : null,
    protocol: context.protocol
      ? {
          summary: context.protocol.summary || context.protocol.protocol?.summary,
          focusDomains: context.protocol.focus_domains,
          actions: context.protocol.protocol?.primary_protocol?.slice(0, 6),
          coachMessage: context.protocol.protocol?.coach_message,
        }
      : null,
    dailyPlan: context.dailyPlan
      ? {
          status: context.dailyPlan.status,
          mode: context.dailyPlan.autopilot_mode,
          summary: context.dailyPlan.summary,
          items: context.dailyPlan.plan?.items?.slice(0, 6),
          memory: context.dailyPlan.plan?.memory,
        }
      : null,
    agentPreferences: context.preferences.slice(0, 10),
    recentOutcomes: context.outcomes.slice(0, 10),
    calendar: context.calendarEvents.slice(0, 8),
    notifications: context.notifications.slice(0, 4),
  };
}

function buildFallbackAnswer(
  question: string,
  context: AgentContext,
  actions: AgentAction[] = []
) {
  const action = context.dailyPlan?.plan?.items?.[0] || context.protocol?.protocol?.primary_protocol?.[0];
  const friction = context.memory?.failurePatterns?.[0];
  const best = context.memory?.bestInterventions?.[0];
  const planSummary =
    context.dailyPlan?.summary ||
    context.protocol?.summary ||
    "Aeonvera is still building your active protocol from your assessment, outcomes, and calendar behavior.";
  const ask = question.toLowerCase();
  const actionPrefix = actions.length
    ? `${actions.map((action) => action.detail).join(" ")} `
    : "";

  if (/why|reason|because|scheduled/.test(ask) && action) {
    return `${actionPrefix}Aeonvera prioritized this because it sits closest to today’s active protocol: ${action.action}. ${action.why || planSummary} Treat it as a clean signal rather than a demand: complete it if it fits, move it if the day is compressed, and let the system learn from that choice.`;
  }

  if (/change|adjust|move|simpler|too much/.test(ask)) {
    return `${actionPrefix}I would simplify the day before adding intensity. ${friction ? `${friction.label} has shown the most resistance recently, so Aeonvera should reduce friction there first.` : "There is not enough repeated resistance yet, so the safest move is one high-leverage action and one recovery-protective check-in."}`;
  }

  if (/best|working|improve|optimize/.test(ask) && best) {
    return `The strongest current signal is ${best.domain}: ${best.action}. It has repeated successfully ${best.successCount} times, so Aeonvera should use it as the anchor and build the rest of the day around preserving that momentum.`;
  }

  return `${actionPrefix}${planSummary} The next intelligent move is to execute one meaningful action, mark the result honestly, and let Aeonvera adapt the following schedule from what actually happened.`;
}

function actionImportance(action: ProtocolAction) {
  const text = [action.domain, action.action, action.why, action.impact].join(" ").toLowerCase();
  let score = 0;
  if (action.impact === "high") score += 3;
  if (/sleep|recovery|stress|training|nutrition|protein|walk|zone 2|strength/.test(text)) score += 2;
  if (/check|track|log|review/.test(text)) score += 1;
  return score;
}

function stablePreferenceKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64) || "agent_preference";
}

function dedupeActions(actions: AgentAction[]) {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = `${action.type}:${action.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isMissingTableError(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message?.includes("schema cache")
  );
}
