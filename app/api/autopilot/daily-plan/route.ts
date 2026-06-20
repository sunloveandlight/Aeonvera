import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccess } from "@/lib/auth/permissions";
import {
  defaultAgentPreferenceMemory,
  getAgentPreferenceMemory,
  type AgentPreferenceMemory,
} from "@/lib/agent/agentPreferenceMemory";
import { getUserPlanForUsage } from "@/lib/usage/tierUsage";
import {
  frozenHealthProfilePayload,
  getHealthSubjectFilter,
  healthSubjectInsertFields,
  resolveActiveHealthProfileContext,
  type ActiveHealthProfileContext,
} from "@/lib/health-profiles/activeHealthProfile";
import { rateLimitRequest } from "@/lib/security/rateLimit";

type AutopilotMode = "manual" | "suggest" | "approve" | "autopilot" | "sovereign";
type ActionScope = "today" | "week" | "check_in" | "later";

type ProtocolAction = {
  domain?: string;
  action?: string;
  why?: string;
  cadence?: string;
  impact?: "low" | "medium" | "high";
};

type ProtocolRow = {
  id: string;
  summary?: string | null;
  focus_domains?: string[] | null;
  protocol?: {
    summary?: string;
    primary_protocol?: ProtocolAction[];
    coach_message?: string;
  } | null;
};

type PreferencesRow = {
  allowed_reminder_domains?: Record<string, boolean>;
  user_id: string;
  mode: AutopilotMode;
  calendar_enabled: boolean;
  notifications_enabled: boolean;
  auto_schedule_enabled: boolean;
  allow_training_blocks: boolean;
  allow_nutrition_blocks: boolean;
  allow_recovery_blocks: boolean;
  allow_check_ins: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  sleep_window_start?: string;
  sunlight_target_minutes?: number;
  hydration_target_ml?: number;
  fasting_window_start?: string;
  fasting_window_end?: string;
  supplement_reminders_enabled?: boolean;
  timezone: string;
};

type OutcomeRow = {
  domain?: string | null;
  action?: string | null;
  outcome?: string | null;
  success?: boolean | null;
  created_at?: string | null;
  measured_at?: string | null;
};

type ExecutionMemory = {
  completionRate: number;
  frictionDomains: string[];
  missedActions: string[];
  planLoad: "light" | "steady" | "ambitious";
  strongDomains: string[];
  total: number;
};

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const entitlement = await ensureAutopilotAccess(admin, user.id);
    if (entitlement) return entitlement;
    const healthProfileContext = await resolveActiveHealthProfileContext({
      supabase: admin,
      loginUserId: user.id,
      requestedHealthProfileId: request.cookies.get("aeonvera.activeHealthProfileId")?.value,
    });
    if (healthProfileContext.isFrozen) {
      return NextResponse.json(frozenHealthProfilePayload(), { status: 423 });
    }
    const healthFilter = getHealthSubjectFilter(healthProfileContext);

    const today = toDateKey(new Date());
    const preferences = await getOrCreatePreferences(admin, user.id, healthProfileContext);
    const [protocol, executionMemory, preferenceMemory] = await Promise.all([
      getLatestProtocol(admin, user.id, healthProfileContext),
      getRecentExecutionMemory(admin, user.id, healthProfileContext),
      getAgentPreferenceMemory({ supabase: admin, userId: user.id }),
    ]);
    const prepared = buildDailyPlan({
      protocol,
      preferences,
      today,
      executionMemory,
      preferenceMemory,
    });
    const { data: existingPlan, error: existingError } = await admin
      .from("daily_execution_plans")
      .select("status,accepted_at,skipped_at,scheduled_event_ids")
      .eq(healthFilter.column, healthFilter.value)
      .eq("plan_date", today)
      .maybeSingle();

    if (existingError && !isMissingAutopilotTable(existingError)) {
      throw existingError;
    }

    const status =
      existingPlan?.status === "accepted" ||
      existingPlan?.status === "auto_scheduled" ||
      existingPlan?.status === "skipped"
        ? existingPlan.status
        : "prepared";

    const { data, error } = await upsertDailyPlan(admin, healthProfileContext, {
      user_id: user.id,
      ...healthSubjectInsertFields(healthProfileContext),
      protocol_id: protocol?.id || null,
      plan_date: today,
      status,
      autopilot_mode: preferences.mode,
      summary: prepared.summary,
      plan: prepared.plan,
      scheduled_event_ids: existingPlan?.scheduled_event_ids || [],
      updated_at: new Date().toISOString(),
    });

    if (error) {
      if (isMissingAutopilotTable(error)) {
        return NextResponse.json({
          migrationRequired: true,
          message:
            "Apply supabase/migrations/20260612120000_autopilot_daily_plans.sql in Supabase, then refresh.",
          preferences,
          plan: prepared.fallbackPlan,
        });
      }

      throw error;
    }

    return NextResponse.json({
      migrationRequired: false,
      preferences,
      plan: data,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not prepare autopilot plan.";
    console.error(message, error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const limited = await rateLimitRequest(request, "autopilot-preferences-update", 40, 60_000);
    if (limited) return limited;

    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const admin = getSupabaseAdmin();
    const entitlement = await ensureAutopilotAccess(admin, user.id);
    if (entitlement) return entitlement;
    const healthProfileContext = await resolveActiveHealthProfileContext({
      supabase: admin,
      loginUserId: user.id,
      requestedHealthProfileId: request.cookies.get("aeonvera.activeHealthProfileId")?.value,
    });
    if (healthProfileContext.isFrozen) {
      return NextResponse.json(frozenHealthProfilePayload(), { status: 423 });
    }

    const current = await getOrCreatePreferences(admin, user.id, healthProfileContext);
    const next = sanitizePreferences(user.id, { ...current, ...body });
    const { data, error } = await upsertAutopilotPreferences(admin, healthProfileContext, {
      ...next,
      ...healthSubjectInsertFields(healthProfileContext),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      if (isMissingAutopilotTable(error)) {
        return NextResponse.json({
          migrationRequired: true,
          message:
            "Apply supabase/migrations/20260612120000_autopilot_daily_plans.sql in Supabase, then refresh.",
          preferences: next,
        });
      }

      throw error;
    }

    return NextResponse.json({ preferences: data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not save autopilot preferences.";
    console.error(message, error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimitRequest(request, "autopilot-plan-update", 60, 60_000);
    if (limited) return limited;

    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const status = normalizePlanStatus(body.status);

    if (!status) {
      return NextResponse.json({ error: "Invalid plan status." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const entitlement = await ensureAutopilotAccess(admin, user.id);
    if (entitlement) return entitlement;
    const healthProfileContext = await resolveActiveHealthProfileContext({
      supabase: admin,
      loginUserId: user.id,
      requestedHealthProfileId: request.cookies.get("aeonvera.activeHealthProfileId")?.value,
    });
    if (healthProfileContext.isFrozen) {
      return NextResponse.json(frozenHealthProfilePayload(), { status: 423 });
    }
    const healthFilter = getHealthSubjectFilter(healthProfileContext);

    const today = toDateKey(new Date());
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      status,
      updated_at: now,
    };

    if (status === "accepted" || status === "auto_scheduled") {
      patch.accepted_at = now;
    }

    if (status === "skipped") {
      patch.skipped_at = now;
    }

    if (Array.isArray(body.scheduled_event_ids)) {
      patch.scheduled_event_ids = body.scheduled_event_ids
        .filter((value: unknown) => typeof value === "string")
        .slice(0, 24);
    }

    const { data, error } = await admin
      .from("daily_execution_plans")
      .update(patch)
      .eq(healthFilter.column, healthFilter.value)
      .eq("plan_date", today)
      .select("*")
      .maybeSingle();

    if (error) {
      throw error;
    }

    await admin.from("behavior_events").insert({
      user_id: user.id,
      ...healthSubjectInsertFields(healthProfileContext),
      type: "autopilot_plan",
      event_type: `daily_plan_${status}`,
      domain: "Execution",
      action: "Daily execution plan",
      outcome: status,
      payload: {
        plan_date: today,
        scheduled_event_ids: patch.scheduled_event_ids || [],
        source: "mobile",
      },
    });

    return NextResponse.json({ plan: data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update daily plan.";
    console.error(message, error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

async function getAuthenticatedUser(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) return user;

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const admin = getSupabaseAdmin();
  const {
    data: { user: bearerUser },
  } = await admin.auth.getUser(token);

  return bearerUser;
}

async function ensureAutopilotAccess(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string
) {
  const subscription = await getUserPlanForUsage({ supabase: admin, userId });

  if (canAccess(subscription.plan, subscription.status, "autopilot_calendar")) {
    return null;
  }

  return NextResponse.json(
    {
      error: "Autopilot daily planning is included in Elite and Sovereign.",
      upgrade: {
        minimumPlan: "elite",
        message:
          "Upgrade to Elite to unlock proactive daily planning, calendar execution, and approval-based automation.",
      },
    },
    { status: 403 }
  );
}

async function upsertDailyPlan(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  healthProfileContext: ActiveHealthProfileContext,
  payload: Record<string, unknown> & { plan_date: string; user_id: string }
) {
  const healthFilter = getHealthSubjectFilter(healthProfileContext);
  const { data: updated, error: updateError } = await supabase
    .from("daily_execution_plans")
    .update(payload)
    .eq(healthFilter.column, healthFilter.value)
    .eq("plan_date", payload.plan_date)
    .select("*")
    .maybeSingle();

  if (updateError && !isMissingAutopilotTable(updateError)) {
    return { data: null, error: updateError };
  }

  if (updated) return { data: updated, error: null };

  return await supabase
    .from("daily_execution_plans")
    .insert(payload)
    .select("*")
    .single();
}

async function upsertAutopilotPreferences(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  healthProfileContext: ActiveHealthProfileContext,
  payload: Record<string, unknown> & { user_id: string }
) {
  const healthFilter = getHealthSubjectFilter(healthProfileContext);
  const { data: updated, error: updateError } = await supabase
    .from("autopilot_preferences")
    .update(payload)
    .eq(healthFilter.column, healthFilter.value)
    .select("*")
    .maybeSingle();

  if (updateError && !isMissingAutopilotTable(updateError)) {
    return { data: null, error: updateError };
  }

  if (updated) return { data: updated, error: null };

  return await supabase
    .from("autopilot_preferences")
    .insert(payload)
    .select("*")
    .single();
}

async function getOrCreatePreferences(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  healthProfileContext: ActiveHealthProfileContext
) {
  const healthFilter = getHealthSubjectFilter(healthProfileContext);
  const { data, error } = await supabase
    .from("autopilot_preferences")
    .select("*")
    .eq(healthFilter.column, healthFilter.value)
    .maybeSingle();

  if (error) {
    if (isMissingAutopilotTable(error)) {
      return defaultPreferences(userId);
    }

    throw error;
  }

  if (data) {
    return sanitizePreferences(userId, data);
  }

  const next = {
    ...defaultPreferences(userId),
    ...healthSubjectInsertFields(healthProfileContext),
  };
  const { data: created } = await upsertAutopilotPreferences(
    supabase,
    healthProfileContext,
    next
  );

  return sanitizePreferences(userId, created || next);
}

async function getLatestProtocol(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  healthProfileContext: ActiveHealthProfileContext
): Promise<ProtocolRow | null> {
  const healthFilter = getHealthSubjectFilter(healthProfileContext);
  const { data, error } = await supabase
    .from("optimization_protocols")
    .select("id,protocol,summary,focus_domains,status,created_at,updated_at")
    .eq(healthFilter.column, healthFilter.value)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as ProtocolRow | null) || null;
}

function buildDailyPlan({
  executionMemory,
  preferenceMemory = defaultAgentPreferenceMemory(),
  preferences,
  protocol,
  today,
}: {
  executionMemory: ExecutionMemory;
  preferenceMemory?: AgentPreferenceMemory;
  preferences: PreferencesRow;
  protocol: ProtocolRow | null;
  today: string;
}) {
  const actions = [
    ...(protocol?.protocol?.primary_protocol || []),
    ...buildLifeAutopilotAnchors(preferences),
  ]
    .map((action, actionIndex) => {
      const scope = classifyActionScope(action);
      return {
        ...action,
        actionIndex,
        scope,
        recommended_time: getRecommendedTime(action, scope, executionMemory, preferenceMemory),
        execution_mode: getExecutionMode(preferences, action, scope),
        adaptation_reason: getAdaptationReason(action, executionMemory, preferenceMemory),
      };
    })
    .filter((action) => action.action)
    .filter((action) => isAllowedByPreferences(preferences, action))
    .sort((a, b) => actionPriority(b, executionMemory) - actionPriority(a, executionMemory));

  const todayLimit =
    getEffectivePlanLoad(executionMemory, preferenceMemory) === "light"
      ? 2
      : getEffectivePlanLoad(executionMemory, preferenceMemory) === "ambitious"
        ? 4
        : 3;
  const setupLimit =
    getEffectivePlanLoad(executionMemory, preferenceMemory) === "light"
      ? 0
      : getEffectivePlanLoad(executionMemory, preferenceMemory) === "ambitious"
        ? 2
        : 1;

  const todayItems = actions
    .filter((action) => action.scope === "today" || action.scope === "check_in")
    .slice(0, todayLimit);
  const setupItems = actions
    .filter((action) => action.scope === "week" || action.scope === "later")
    .slice(0, setupLimit);
  const selectedItems = todayItems.length ? todayItems : actions.slice(0, todayLimit);
  const itemCount = selectedItems.length + setupItems.length;
  const summary = itemCount
    ? buildAdaptiveSummary(itemCount, selectedItems, executionMemory, preferenceMemory)
    : "Aeonvera is ready to prepare your day once a protocol is active.";

  const plan = {
    date: today,
    mode: preferences.mode,
    summary,
    items: [...selectedItems, ...setupItems],
    principles: [
      "Protect recovery before adding intensity.",
      "Schedule the highest leverage action before the day becomes noisy.",
      "Keep opt-out visible and preserve user control.",
      executionMemory.total
        ? "Use recent completion signals to adjust today before adding more."
        : "Begin with a clean execution baseline, then adapt from real behavior.",
    ],
    memory: {
      completion_rate: executionMemory.completionRate,
      friction_domains: executionMemory.frictionDomains,
      plan_load: executionMemory.planLoad,
      preference_load: preferenceMemory.preferredLoad,
      coaching_tone: preferenceMemory.coachingTone,
      reminder_window: preferenceMemory.reminderWindow,
      training_time: preferenceMemory.trainingTime,
      avoid_morning_training: preferenceMemory.avoidMorningTraining,
      strong_domains: executionMemory.strongDomains,
      total_signals: executionMemory.total,
    },
  };

  return {
    summary,
    plan,
    fallbackPlan: {
      id: "preview",
      status: "prepared",
      plan_date: today,
      autopilot_mode: preferences.mode,
      summary,
      plan,
    },
  };
}

async function getRecentExecutionMemory(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  healthProfileContext: ActiveHealthProfileContext
): Promise<ExecutionMemory> {
  const since = new Date();
  since.setDate(since.getDate() - 21);
  const healthFilter = getHealthSubjectFilter(healthProfileContext);

  const { data, error } = await supabase
    .from("intervention_outcomes")
    .select("domain,action,outcome,success,created_at,measured_at")
    .eq(healthFilter.column, healthFilter.value)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) {
    if (isMissingFeedbackTable(error)) return defaultExecutionMemory();
    throw error;
  }

  return buildExecutionMemory((data || []) as OutcomeRow[]);
}

function buildExecutionMemory(outcomes: OutcomeRow[]): ExecutionMemory {
  if (!outcomes.length) return defaultExecutionMemory();

  let successes = 0;
  let failures = 0;
  const domainStats = new Map<string, { failure: number; success: number }>();
  const actionStats = new Map<string, { failure: number; success: number }>();

  for (const item of outcomes) {
    const isSuccess = item.success === true || item.outcome === "success";
    const isFailure = item.success === false || item.outcome === "failure";
    if (isSuccess) successes += 1;
    if (isFailure) failures += 1;

    const domain = normalizeMemoryKey(item.domain || "");
    if (domain) {
      const stat = domainStats.get(domain) || { failure: 0, success: 0 };
      if (isSuccess) stat.success += 1;
      if (isFailure) stat.failure += 1;
      domainStats.set(domain, stat);
    }

    const action = normalizeMemoryKey(item.action || "");
    if (action) {
      const stat = actionStats.get(action) || { failure: 0, success: 0 };
      if (isSuccess) stat.success += 1;
      if (isFailure) stat.failure += 1;
      actionStats.set(action, stat);
    }
  }

  const scoredTotal = successes + failures;
  const completionRate = scoredTotal ? roundTwo(successes / scoredTotal) : 0.5;
  const frictionDomains = Array.from(domainStats.entries())
    .filter(([, stat]) => stat.failure > 0 && stat.failure >= stat.success)
    .map(([domain]) => domain)
    .slice(0, 3);
  const strongDomains = Array.from(domainStats.entries())
    .filter(([, stat]) => stat.success >= 2 && stat.success > stat.failure)
    .map(([domain]) => domain)
    .slice(0, 3);
  const missedActions = Array.from(actionStats.entries())
    .filter(([, stat]) => stat.failure > 0 && stat.failure >= stat.success)
    .map(([action]) => action)
    .slice(0, 8);
  const planLoad =
    scoredTotal >= 3 && completionRate < 0.55
      ? "light"
      : scoredTotal >= 3 && completionRate > 0.78
        ? "ambitious"
        : "steady";

  return {
    completionRate,
    frictionDomains,
    missedActions,
    planLoad,
    strongDomains,
    total: outcomes.length,
  };
}

function defaultExecutionMemory(): ExecutionMemory {
  return {
    completionRate: 0.72,
    frictionDomains: [],
    missedActions: [],
    planLoad: "steady",
    strongDomains: [],
    total: 0,
  };
}

function buildAdaptiveSummary(
  itemCount: number,
  selectedItems: Array<ProtocolAction & { domain?: string }>,
  memory: ExecutionMemory,
  preferenceMemory = defaultAgentPreferenceMemory()
) {
  const domains = selectedItems
    .slice(0, 2)
    .map((action) => action.domain || "Optimization")
    .join(" and ");

  if (preferenceMemory.preferredLoad === "light") {
    return `Aeonvera kept today deliberately light: ${itemCount} essential action${
      itemCount === 1 ? "" : "s"
    } around ${domains}, aligned with your preference for fewer, higher-leverage moves.`;
  }

  if (preferenceMemory.coachingTone === "direct") {
    return `Today is clean and direct: ${itemCount} action${
      itemCount === 1 ? "" : "s"
    } around ${domains}. Aeonvera is removing ambiguity so execution is obvious.`;
  }

  if (preferenceMemory.coachingTone === "supportive") {
    return `Aeonvera prepared a calmer day: ${itemCount} grounded action${
      itemCount === 1 ? "" : "s"
    } around ${domains}, with enough structure to move forward without excess pressure.`;
  }

  if (memory.total && memory.planLoad === "light") {
    return `Aeonvera narrowed today to ${itemCount} essential action${
      itemCount === 1 ? "" : "s"
    }, using recent feedback to protect momentum around ${domains}.`;
  }

  if (memory.total && memory.planLoad === "ambitious") {
    return `Aeonvera prepared ${itemCount} action${
      itemCount === 1 ? "" : "s"
    } for today, building on your strongest recent execution rhythm in ${domains}.`;
  }

  return `Aeonvera prepared ${itemCount} action${
    itemCount === 1 ? "" : "s"
  } for today: ${domains}.`;
}

function defaultPreferences(userId: string): PreferencesRow {
  return {
    user_id: userId,
    mode: "approve",
    calendar_enabled: true,
    notifications_enabled: true,
    auto_schedule_enabled: false,
    allow_training_blocks: true,
    allow_nutrition_blocks: true,
    allow_recovery_blocks: true,
    allow_check_ins: true,
    quiet_hours_start: "22:00",
    quiet_hours_end: "07:00",
    timezone: "UTC",
  };
}

function sanitizePreferences(userId: string, value: Partial<PreferencesRow>) {
  const mode = normalizeMode(value.mode);

  return {
    user_id: userId,
    mode,
    calendar_enabled: value.calendar_enabled !== false,
    notifications_enabled: value.notifications_enabled !== false,
    auto_schedule_enabled: mode === "autopilot" || mode === "sovereign"
      ? value.auto_schedule_enabled === true
      : false,
    allow_training_blocks: value.allow_training_blocks !== false,
    allow_nutrition_blocks: value.allow_nutrition_blocks !== false,
    allow_recovery_blocks: value.allow_recovery_blocks !== false,
    allow_check_ins: value.allow_check_ins !== false,
    quiet_hours_start: sanitizeTime(value.quiet_hours_start) || "22:00",
    quiet_hours_end: sanitizeTime(value.quiet_hours_end) || "07:00",
    timezone: typeof value.timezone === "string" && value.timezone.length < 80
      ? value.timezone
      : "UTC",
  };
}

function normalizeMode(value: unknown): AutopilotMode {
  return value === "manual" ||
    value === "suggest" ||
    value === "approve" ||
    value === "autopilot" ||
    value === "sovereign"
    ? value
    : "approve";
}

function normalizePlanStatus(value: unknown) {
  return value === "accepted" ||
    value === "adjusted" ||
    value === "skipped" ||
    value === "auto_scheduled"
    ? value
    : null;
}

function classifyActionScope(action: ProtocolAction): ActionScope {
  const text = [action.domain, action.action, action.cadence, action.why]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/(measure|check|track|log|record|weigh|weight|metric|retest|lab|blood|hrv|resting heart|sleep score|recovery score|biomarker)/.test(text)) {
    return "check_in";
  }

  if (/(weekly|week|2x|3x|4x|twice|three times|session|sessions|zone 2|strength|resistance|meal prep|review)/.test(text)) {
    return "week";
  }

  if (/(daily|today|morning|evening|nightly|bedtime|wake|walk|hydrate|meal)/.test(text)) {
    return "today";
  }

  return "later";
}

function getRecommendedTime(
  action: ProtocolAction,
  scope: ActionScope,
  memory = defaultExecutionMemory(),
  preferenceMemory = defaultAgentPreferenceMemory()
) {
  const text = [action.domain, action.action, action.cadence, action.why]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const actionWasMissed = memory.missedActions.includes(normalizeMemoryKey(action.action || ""));
  const domainHasFriction = memory.frictionDomains.includes(normalizeMemoryKey(action.domain || ""));
  const isTraining = /(zone 2|cardio|walk|steps|run|training|workout|strength|resistance|mobility|exercise|movement)/.test(text);

  if (isTraining && (preferenceMemory.avoidMorningTraining || preferenceMemory.trainingTime === "later")) {
    return actionWasMissed || domainHasFriction ? "16:30" : "17:30";
  }

  if (isTraining && preferenceMemory.trainingTime === "morning") {
    return actionWasMissed || domainHasFriction ? "08:30" : "08:00";
  }

  if (preferenceMemory.reminderWindow === "after_lunch" && scope !== "check_in") return "13:30";
  if (preferenceMemory.reminderWindow === "after_dinner" && scope !== "check_in") return "19:30";
  if (preferenceMemory.reminderWindow === "evening" && scope !== "check_in") return "18:30";
  if (preferenceMemory.reminderWindow === "afternoon" && scope !== "check_in") return "15:00";
  if (preferenceMemory.reminderWindow === "morning") return "08:30";

  if (/(sleep|bedtime|wind down|evening|night|recovery|relax|caffeine)/.test(text)) {
    return actionWasMissed || domainHasFriction ? "20:00" : "20:30";
  }

  if (/(wake|morning|sunlight|weigh|weight|hrv|blood pressure|glucose|fasting)/.test(text)) {
    return actionWasMissed || domainHasFriction ? "08:30" : "08:00";
  }

  if (/(zone 2|cardio|walk|steps|run|training|workout|strength|resistance|mobility)/.test(text)) {
    return actionWasMissed || domainHasFriction ? "16:30" : "17:30";
  }

  if (/(meal|nutrition|protein|supplement|creatine|hydration|hydrate|food)/.test(text)) {
    return actionWasMissed || domainHasFriction ? "11:45" : "12:30";
  }

  if (/(journal|meditation|breath|stress|mindfulness|reflection)/.test(text)) {
    return actionWasMissed || domainHasFriction ? "18:45" : "19:30";
  }

  if (scope === "check_in") return "08:30";
  if (scope === "week") return "09:30";
  return "10:00";
}

function getExecutionMode(
  preferences: PreferencesRow,
  action: ProtocolAction,
  scope: ActionScope
) {
  if (preferences.mode === "manual") return "manual";
  if (!preferences.calendar_enabled && !preferences.notifications_enabled) return "suggest";
  if (preferences.mode === "autopilot" || preferences.mode === "sovereign") {
    return preferences.auto_schedule_enabled ? "schedule" : "approve";
  }
  if (scope === "check_in" && preferences.notifications_enabled) return "notify";
  if (preferences.mode === "approve") return "approve";
  return "suggest";
}

function isAllowedByPreferences(
  preferences: PreferencesRow,
  action: ProtocolAction & { scope: ActionScope }
) {
  const text = [action.domain, action.action, action.why].filter(Boolean).join(" ").toLowerCase();
  const domains = preferences.allowed_reminder_domains || {};

  if (!preferences.allow_check_ins && action.scope === "check_in") return false;
  if (domains.hydration === false && /(hydration|hydrate|water)/.test(text)) return false;
  if (domains.fasting === false && /(fast|fasting|eating window)/.test(text)) return false;
  if (domains.food === false && /(nutrition|meal|protein|food)/.test(text)) return false;
  if (domains.sunlight === false && /(sunlight|outdoor|fresh air|light)/.test(text)) return false;
  if (domains.sleep === false && /(sleep|bedtime|wind down)/.test(text)) return false;
  if (domains.supplements === false && /(supplement|creatine|vitamin)/.test(text)) return false;
  if (!preferences.allow_training_blocks && /(training|workout|strength|resistance|zone 2|cardio|movement)/.test(text)) return false;
  if (!preferences.allow_nutrition_blocks && /(nutrition|meal|protein|food|supplement|hydration)/.test(text)) return false;
  if (!preferences.allow_recovery_blocks && /(sleep|recovery|stress|breath|meditation|relax)/.test(text)) return false;

  return true;
}

function buildLifeAutopilotAnchors(preferences: PreferencesRow): ProtocolAction[] {
  const domains = preferences.allowed_reminder_domains || {};
  const enabled = (key: string, fallback = true) => domains[key] ?? fallback;
  const actions: ProtocolAction[] = [];

  if (enabled("hydration")) {
    actions.push({
      domain: "Hydration",
      action: `Reach ${preferences.hydration_target_ml || 2500} ml water by early evening`,
      cadence: "daily",
      impact: "medium",
      why: "Hydration supports recovery, cognition, training output, and appetite stability.",
    });
  }

  if (enabled("sunlight")) {
    actions.push({
      domain: "Sunlight",
      action: `Get ${preferences.sunlight_target_minutes || 20} minutes outside before midday`,
      cadence: "daily",
      impact: "medium",
      why: "Morning light anchors circadian rhythm and helps sleep timing.",
    });
  }

  if (enabled("fasting")) {
    actions.push({
      domain: "Fasting",
      action: `Protect eating window from ${preferences.fasting_window_end || "08:00"} to ${preferences.fasting_window_start || "20:00"}`,
      cadence: "daily",
      impact: "medium",
      why: "A clear eating window reduces decision fatigue and keeps metabolic rhythm consistent.",
    });
  }

  if (enabled("sleep")) {
    actions.push({
      domain: "Sleep",
      action: `Begin wind-down at ${preferences.sleep_window_start || "22:30"}`,
      cadence: "daily",
      impact: "high",
      why: "Sleep is the highest-leverage recovery and biological-age input.",
    });
  }

  if (enabled("recovery")) {
    actions.push({
      domain: "Recovery",
      action: "Add one 5-minute nervous-system reset",
      cadence: "daily",
      impact: "medium",
      why: "Small recovery blocks reduce stress load without crowding the day.",
    });
  }

  if (enabled("supplements", false) && preferences.supplement_reminders_enabled) {
    actions.push({
      domain: "Supplements",
      action: "Confirm clinician-approved supplement routine",
      cadence: "daily",
      impact: "low",
      why: "Aeonvera can remind, but does not prescribe medication or supplement changes.",
    });
  }

  if (enabled("check_ins")) {
    actions.push({
      domain: "Check-in",
      action: "Log the one signal that changed most today",
      cadence: "daily",
      impact: "medium",
      why: "Short feedback loops teach the model what is actually working.",
    });
  }

  return actions;
}

function actionPriority(
  action: ProtocolAction & { scope: ActionScope },
  memory = defaultExecutionMemory()
) {
  const impact = action.impact === "high" ? 4 : action.impact === "medium" ? 2 : 1;
  const scope = action.scope === "today" ? 4 : action.scope === "check_in" ? 3 : action.scope === "week" ? 2 : 1;
  const domain = normalizeMemoryKey(action.domain || "");
  const actionKey = normalizeMemoryKey(action.action || "");
  const frictionBoost = memory.frictionDomains.includes(domain) ? 1.2 : 0;
  const missedBoost = memory.missedActions.includes(actionKey) ? 0.8 : 0;
  const strongBoost = memory.strongDomains.includes(domain) ? 0.5 : 0;
  return impact + scope + frictionBoost + missedBoost + strongBoost;
}

function getAdaptationReason(
  action: ProtocolAction,
  memory: ExecutionMemory,
  preferenceMemory: AgentPreferenceMemory
) {
  const text = [action.domain, action.action, action.why, action.cadence]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    /(training|workout|strength|resistance|zone 2|cardio|walk|exercise|movement)/.test(text) &&
    (preferenceMemory.avoidMorningTraining || preferenceMemory.trainingTime === "later")
  ) {
    return "adapted_to_preferred_training_window";
  }

  if (preferenceMemory.preferredLoad === "light") return "simplified_from_stated_preference";
  if (preferenceMemory.reminderWindow) return "timed_from_reminder_preference";
  if (preferenceMemory.coachingTone !== "balanced") return "adapted_to_coaching_style";

  if (!memory.total) return "baseline";

  const actionKey = normalizeMemoryKey(action.action || "");
  const domain = normalizeMemoryKey(action.domain || "");

  if (memory.missedActions.includes(actionKey)) return "resurfaced_after_missed_execution";
  if (memory.frictionDomains.includes(domain)) return "simplified_after_domain_friction";
  if (memory.strongDomains.includes(domain)) return "expanded_from_recent_strength";
  return "steady_from_recent_feedback";
}

function getEffectivePlanLoad(
  memory: ExecutionMemory,
  preferenceMemory: AgentPreferenceMemory
) {
  if (preferenceMemory.preferredLoad !== "steady") return preferenceMemory.preferredLoad;
  return memory.planLoad;
}

function normalizeMemoryKey(value: string) {
  return value.trim().toLowerCase();
}

function roundTwo(value: number) {
  return Math.round(value * 100) / 100;
}

function sanitizeTime(value: unknown) {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value) ? value : "";
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isMissingAutopilotTable(error: { message?: string; code?: string }) {
  return (
    error.code === "PGRST205" ||
    error.message?.includes("autopilot_preferences") ||
    error.message?.includes("daily_execution_plans") ||
    error.message?.includes("schema cache")
  );
}

function isMissingFeedbackTable(error: { message?: string; code?: string }) {
  return (
    error.code === "PGRST205" ||
    error.message?.includes("intervention_outcomes") ||
    error.message?.includes("schema cache")
  );
}
