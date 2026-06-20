import { buildExecutionSummary, getExecutionWindow } from "@/lib/execution/executionSummary";
import type { ActiveHealthProfileContext } from "@/lib/health-profiles/activeHealthProfile";
import {
  loadOrBuildCoachMemoryProfile,
  loadStoredCoachMemoryProfile,
} from "@/lib/memory/coachMemoryProfile";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

type CalendarEventRow = {
  action?: string | null;
  action_scope?: string | null;
  recurrence?: string | null;
  scheduled_for?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type OutcomeRow = {
  domain?: string | null;
  action?: string | null;
  outcome?: string | null;
  success?: boolean | null;
  notes?: string | null;
  measured_at?: string | null;
  created_at?: string | null;
};

type ProtocolRow = {
  id: string;
  summary?: string | null;
  focus_domains?: string[] | null;
  protocol?: {
    summary?: string;
    primary_protocol?: Array<{
      domain?: string;
      action?: string;
      why?: string;
      impact?: "low" | "medium" | "high";
    }>;
    coach_message?: string;
  } | null;
};

type HealthStateRow = {
  risk_scores?: Record<string, number | string | null> | null;
  baseline?: Record<string, number | string | null> | null;
  updated_at?: string | null;
};

export type DailyIntelligenceBrief = {
  title: string;
  message: string;
  href: string;
  healthPriority: string;
  behaviorPriority: string;
  calendarPriority: string;
  primaryAction: string;
  confidence: number;
  style: string;
  generatedAt: string;
};

export async function buildDailyIntelligenceBrief(
  supabase: SupabaseAdmin,
  userId: string,
  healthProfileContext?: ActiveHealthProfileContext | null
): Promise<DailyIntelligenceBrief> {
  const now = new Date();
  const window = getExecutionWindow(now);
  const nextDay = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  const subjectColumn = healthProfileContext?.healthProfileId ? "health_profile_id" : "user_id";
  const subjectValue = healthProfileContext?.healthProfileId || userId;
  const loadMemory = healthProfileContext?.isFrozen
    ? loadStoredCoachMemoryProfile
    : loadOrBuildCoachMemoryProfile;
  const [memory, outcomesResult, calendarResult, protocolResult, healthResult] =
    await Promise.all([
      loadMemory(supabase, userId, healthProfileContext),
      supabase
        .from("intervention_outcomes")
        .select("domain, action, outcome, success, notes, measured_at, created_at")
        .eq(subjectColumn, subjectValue)
        .gte("created_at", window.startIso)
        .order("created_at", { ascending: false })
        .limit(80),
      supabase
        .from("calendar_events")
        .select("action, action_scope, recurrence, scheduled_for, status, created_at")
        .eq(subjectColumn, subjectValue)
        .gte("scheduled_for", window.startIso)
        .order("scheduled_for", { ascending: true })
        .limit(80),
      supabase
        .from("optimization_protocols")
        .select("id, protocol, summary, focus_domains")
        .eq(subjectColumn, subjectValue)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("health_states")
        .select("risk_scores, baseline, updated_at")
        .eq(subjectColumn, subjectValue)
        .maybeSingle(),
    ]);

  logOptionalError("Daily brief outcomes", outcomesResult.error);
  logOptionalError("Daily brief calendar", calendarResult.error);
  logOptionalError("Daily brief protocol", protocolResult.error);
  logOptionalError("Daily brief health", healthResult.error);

  const outcomes = outcomesResult.error ? [] : ((outcomesResult.data || []) as OutcomeRow[]);
  const calendarEvents = calendarResult.error
    ? []
    : ((calendarResult.data || []) as CalendarEventRow[]);
  const protocol = protocolResult.error ? null : ((protocolResult.data || null) as ProtocolRow | null);
  const healthState = healthResult.error ? null : ((healthResult.data || null) as HealthStateRow | null);
  const execution = buildExecutionSummary({ outcomes, calendarEvents, now });
  const todayEvents = calendarEvents.filter((event) => {
    const scheduled = event.scheduled_for ? new Date(event.scheduled_for).getTime() : NaN;
    return Number.isFinite(scheduled) && scheduled >= now.getTime() && scheduled <= new Date(nextDay).getTime();
  });

  const healthPriority = buildHealthPriority(healthState);
  const behaviorPriority = buildBehaviorPriority(memory, execution);
  const calendarPriority = buildCalendarPriority(todayEvents, protocol);
  const primaryAction = buildPrimaryAction({
    behaviorPriority,
    calendarPriority,
    protocol,
    todayEvents,
  });
  const confidence = Math.max(
    memory?.confidence || 0.35,
    execution.total ? Math.min(0.92, 0.45 + execution.total * 0.04) : 0.4
  );

  return {
    title: buildBriefTitle(memory?.communicationStyle, execution.status),
    message: buildBriefMessage({
      healthPriority,
      behaviorPriority,
      calendarPriority,
      executionScore: execution.score,
      completed: execution.completed,
      total: execution.total,
      style: memory?.communicationStyle || "balanced",
    }),
    href: todayEvents.length ? "/companion" : protocol ? "/optimization" : "/assessment",
    healthPriority,
    behaviorPriority,
    calendarPriority,
    primaryAction,
    confidence: Number(confidence.toFixed(2)),
    style: memory?.communicationStyle || "balanced",
    generatedAt: now.toISOString(),
  };
}

function buildHealthPriority(healthState: HealthStateRow | null) {
  const risks = healthState?.risk_scores || {};
  const top = Object.entries(risks)
    .map(([domain, value]) => ({ domain, value: Number(value) }))
    .filter((item) => Number.isFinite(item.value))
    .sort((a, b) => b.value - a.value)[0];

  if (!top || top.value < 35) {
    return "Keep the system steady and protect recovery capacity.";
  }

  return `${readableDomain(top.domain)} is the highest biological signal to watch today.`;
}

function buildBehaviorPriority(
  memory: Awaited<ReturnType<typeof loadOrBuildCoachMemoryProfile>>,
  execution: ReturnType<typeof buildExecutionSummary>
) {
  const friction = memory?.failurePatterns?.[0] || execution.topSkippedPattern;

  if (friction) {
    return `${readableDomain(friction.label)} needs a simpler, cleaner path today.`;
  }

  if (execution.status === "strong") {
    return "Preserve the rhythm. Do not overcomplicate what is already working.";
  }

  return "Choose one visible action and close the loop with a clear signal.";
}

function buildCalendarPriority(todayEvents: CalendarEventRow[], protocol: ProtocolRow | null) {
  const nextEvent = todayEvents.find((event) => event.status !== "cancelled");

  if (nextEvent?.action) {
    return `Your next scheduled block is ${nextEvent.action}.`;
  }

  const nextProtocolAction = protocol?.protocol?.primary_protocol?.[0]?.action;

  if (nextProtocolAction) {
    return `Place ${nextProtocolAction} into the day before attention fragments.`;
  }

  return "Create one protocol block so the day has a clear anchor.";
}

function buildPrimaryAction({
  behaviorPriority,
  calendarPriority,
  protocol,
  todayEvents,
}: {
  behaviorPriority: string;
  calendarPriority: string;
  protocol: ProtocolRow | null;
  todayEvents: CalendarEventRow[];
}) {
  return (
    todayEvents.find((event) => event.action)?.action ||
    protocol?.protocol?.primary_protocol?.[0]?.action ||
    behaviorPriority ||
    calendarPriority
  );
}

function buildBriefTitle(
  style: string | undefined,
  status: ReturnType<typeof buildExecutionSummary>["status"]
) {
  if (status === "strong") return "Your rhythm is consolidating.";
  if (style === "accountability") return "Today needs elegant constraint.";
  if (style === "encouraging") return "Begin gently, but deliberately.";
  return "Today has one clear center.";
}

function buildBriefMessage({
  healthPriority,
  behaviorPriority,
  calendarPriority,
  executionScore,
  completed,
  total,
  style,
}: {
  healthPriority: string;
  behaviorPriority: string;
  calendarPriority: string;
  executionScore: number;
  completed: number;
  total: number;
  style: string;
}) {
  const executionLine = total
    ? `You have completed ${completed} of ${total} protocol actions this week, with a ${executionScore}% execution score.`
    : "Your execution pattern is still forming.";
  const opener =
    style === "accountability"
      ? "The day works best with fewer decisions and cleaner boundaries."
      : style === "encouraging"
        ? "Start with the action that gives your system the most relief."
        : "The strongest day is the one organized around the right signal.";

  return `${opener} ${executionLine} ${healthPriority} ${behaviorPriority} ${calendarPriority}`;
}

function readableDomain(domain: string) {
  const value = domain.toLowerCase();

  if (value.includes("stress")) return "Stress regulation";
  if (value.includes("sleep")) return "Sleep";
  if (value.includes("training") || value.includes("activity")) return "Training";
  if (value.includes("nutrition")) return "Nutrition";
  if (value.includes("recovery")) return "Recovery";
  if (value.includes("metabolic")) return "Metabolic health";

  return domain
    .replace(/^risk[_-]/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function logOptionalError(label: string, error: { code?: string; message?: string } | null) {
  if (!error || isMissingOptionalTable(error)) return;
  console.error(`[${label} Error]`, error.message);
}

function isMissingOptionalTable(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message?.includes("schema cache")
  );
}
