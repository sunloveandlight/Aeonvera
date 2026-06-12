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

type AgentContext = {
  memory: Awaited<ReturnType<typeof loadOrBuildCoachMemoryProfile>>;
  protocol: ProtocolRow | null;
  dailyPlan: DailyPlanRow | null;
  outcomes: ExecutionRow[];
  calendarEvents: CalendarRow[];
  notifications: NotificationRow[];
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
  const openai = getOpenAI();

  if (!openai) {
    return {
      answer: buildFallbackAnswer(question, context),
      mode: "fallback" as const,
      context,
    };
  }

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      temperature: 0.45,
      max_tokens: 620,
      messages: [
        {
          role: "system",
          content:
            "You are Aeonvera, a premium personal health agent. Use only the supplied user context. Be calm, precise, sophisticated, and practical. Explain why the recommendation exists, what to do next, and what Aeonvera will watch. Do not diagnose, prescribe medication, or claim certainty. Keep answers under 180 words unless the user asks for detail.",
        },
        {
          role: "user",
          content: `User context:\n${JSON.stringify(summarizeContext(context), null, 2)}`,
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
        answer,
        mode: "generated" as const,
        context,
      };
    }
  } catch (error) {
    console.error(
      "[Personal Health Agent Error]",
      error instanceof Error ? error.message : error
    );
  }

  return {
    answer: buildFallbackAnswer(question, context),
    mode: "fallback" as const,
    context,
  };
}

async function loadAgentContext(
  supabase: SupabaseAdmin,
  userId: string
): Promise<AgentContext> {
  const today = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();

  const [memory, protocolRes, planRes, outcomesRes, calendarRes, notificationRes] =
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
          .select("status,autopilot_mode,summary,plan,updated_at")
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
    ]);

  return {
    memory,
    protocol: (protocolRes.data as ProtocolRow | null) || null,
    dailyPlan: (planRes.data as DailyPlanRow | null) || null,
    outcomes: ((outcomesRes.data || []) as ExecutionRow[]).slice(0, 24),
    calendarEvents: ((calendarRes.data || []) as CalendarRow[]).slice(0, 18),
    notifications: ((notificationRes.data || []) as NotificationRow[]).slice(0, 8),
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
    recentOutcomes: context.outcomes.slice(0, 10),
    calendar: context.calendarEvents.slice(0, 8),
    notifications: context.notifications.slice(0, 4),
  };
}

function buildFallbackAnswer(question: string, context: AgentContext) {
  const action = context.dailyPlan?.plan?.items?.[0] || context.protocol?.protocol?.primary_protocol?.[0];
  const friction = context.memory?.failurePatterns?.[0];
  const best = context.memory?.bestInterventions?.[0];
  const planSummary =
    context.dailyPlan?.summary ||
    context.protocol?.summary ||
    "Aeonvera is still building your active protocol from your assessment, outcomes, and calendar behavior.";
  const ask = question.toLowerCase();

  if (/why|reason|because|scheduled/.test(ask) && action) {
    return `Aeonvera prioritized this because it sits closest to today’s active protocol: ${action.action}. ${action.why || planSummary} I would treat it as a clean signal rather than a demand: complete it if it fits, move it if the day is compressed, and let the system learn from that choice.`;
  }

  if (/change|adjust|move|simpler|too much/.test(ask)) {
    return `I would simplify the day before adding intensity. ${friction ? `${friction.label} has shown the most resistance recently, so Aeonvera should reduce friction there first.` : "There is not enough repeated resistance yet, so the safest move is one high-leverage action and one recovery-protective check-in."}`;
  }

  if (/best|working|improve|optimize/.test(ask) && best) {
    return `The strongest current signal is ${best.domain}: ${best.action}. It has repeated successfully ${best.successCount} times, so Aeonvera should use it as the anchor and build the rest of the day around preserving that momentum.`;
  }

  return `${planSummary} The next intelligent move is to execute one meaningful action, mark the result honestly, and let Aeonvera adapt the following schedule from what actually happened.`;
}

function isMissingTableError(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message?.includes("schema cache")
  );
}
