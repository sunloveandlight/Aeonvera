import type { SupabaseClient } from "@supabase/supabase-js";
import { canAccess } from "@/lib/auth/permissions";
import {
  defaultAgentPreferenceMemory,
  getAgentPreferenceMemory,
  type AgentPreferenceMemory,
} from "@/lib/agent/agentPreferenceMemory";
import { sendCoachEmail } from "@/lib/notifications/email";
import { sendCoachPushNotifications } from "@/lib/notifications/push";
import { getUserPlanForUsage } from "@/lib/usage/tierUsage";
import {
  createLegacyActiveHealthProfileContext,
  getHealthSubjectFilter,
  healthSubjectInsertFields,
  type ActiveHealthProfileContext,
} from "@/lib/health-profiles/activeHealthProfile";

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

type AutopilotPreferences = {
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

type NotificationPreferences = {
  email_enabled?: boolean | null;
  push_enabled?: boolean | null;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  timezone?: string | null;
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

type MorningEmailResult =
  | { status: "sent"; provider: "resend"; providerMessageId?: string }
  | { status: "skipped"; provider: "resend"; error: string }
  | { status: "failed"; provider: "resend"; error: string };

export async function runMorningAutopilotBrief({
  supabase,
  userId,
  healthProfileContext,
}: {
  supabase: SupabaseClient;
  userId: string;
  healthProfileContext?: ActiveHealthProfileContext | null;
}) {
  const today = toDateKey(new Date());
  const activeHealthProfileContext =
    healthProfileContext || createLegacyActiveHealthProfileContext(userId);
  const subscription = await getUserPlanForUsage({ supabase, userId });

  if (!canAccess(subscription.plan, subscription.status, "autopilot_calendar")) {
    return {
      status: "skipped",
      reason: "Morning Autopilot is not included in this tier",
    };
  }

  const [autopilotPreferences, protocol, userResult, executionMemory, preferenceMemory] = await Promise.all([
    getOrCreateAutopilotPreferences(supabase, userId, activeHealthProfileContext),
    getLatestProtocol(supabase, userId, activeHealthProfileContext),
    supabase.auth.admin.getUserById(userId),
    getRecentExecutionMemory(supabase, userId, activeHealthProfileContext),
    getAgentPreferenceMemory({
      supabase,
      userId,
      healthProfileContext: activeHealthProfileContext,
    }),
  ]);

  if (autopilotPreferences.mode === "manual") {
    return { status: "skipped", reason: "Autopilot mode is manual" };
  }

  if (!protocol?.protocol?.primary_protocol?.length) {
    return { status: "skipped", reason: "No active optimization protocol" };
  }

  const prepared = buildDailyPlan({
    executionMemory,
    preferenceMemory,
    preferences: autopilotPreferences,
    protocol,
    today,
  });

  if (!prepared.plan.items.length) {
    return { status: "skipped", reason: "No eligible actions for today" };
  }

  const existingPlan = await getExistingPlan(
    supabase,
    userId,
    today,
    activeHealthProfileContext
  );
  const alreadyAccepted =
    existingPlan?.status === "accepted" || existingPlan?.status === "auto_scheduled";
  const status = alreadyAccepted ? existingPlan.status : "prepared";

  const { data: plan, error: planError } = await upsertDailyExecutionPlan({
    supabase,
    userId,
    healthProfileContext: activeHealthProfileContext,
    payload: {
      protocol_id: protocol.id,
      plan_date: today,
      status,
      autopilot_mode: autopilotPreferences.mode,
      summary: prepared.summary,
      plan: prepared.plan,
      scheduled_event_ids: existingPlan?.scheduled_event_ids || [],
      updated_at: new Date().toISOString(),
    },
  });

  if (planError) {
    if (isMissingAutopilotTable(planError)) {
      return { status: "skipped", reason: "Autopilot migration is not applied" };
    }

    throw planError;
  }

  if (!plan) {
    return { status: "skipped", reason: "Daily plan could not be prepared" };
  }

  const delivery = await deliverMorningPlan({
    supabase,
    userId,
    healthProfileContext: activeHealthProfileContext,
    user: userResult.data.user,
    title: "Aeonvera Autopilot: Today is prepared",
    message: buildMorningMessage(prepared.plan.items),
    planId: plan.id,
    planSummary: prepared.summary,
  });

  await supabase.from("behavior_events").insert({
    user_id: userId,
    ...healthSubjectInsertFields(activeHealthProfileContext),
    type: "autopilot_plan",
    event_type: "morning_autopilot_prepared",
    domain: "Execution",
    action: "Morning daily plan prepared",
    outcome: delivery.push.status,
    payload: {
      plan_id: plan.id,
      plan_date: today,
      plan_status: plan.status,
      delivery,
      source: "daily_coach_cron",
    },
  });

  return {
    status: "prepared",
    plan_id: plan.id,
    delivery,
  };
}

async function deliverMorningPlan({
  supabase,
  userId,
  healthProfileContext,
  user,
  title,
  message,
  planId,
  planSummary,
}: {
  supabase: SupabaseClient;
  userId: string;
  healthProfileContext: ActiveHealthProfileContext;
  user?: { email?: string; user_metadata?: { notification_preferences?: NotificationPreferences } } | null;
  title: string;
  message: string;
  planId: string;
  planSummary: string;
}) {
  const prefs = await loadNotificationPreferences(supabase, userId, user, healthProfileContext);
  const quietHoursActive = isQuietHoursActive(prefs);
  const emailEnabled = prefs.email_enabled !== false;
  const pushEnabled = prefs.push_enabled === true;
  const payload = {
    plan_id: planId,
    plan_summary: planSummary,
    path: "/companion?focus=autopilot",
    url: "/companion?focus=autopilot",
    target: "autopilot",
    source: "morning_autopilot",
  };

  await recordDelivery({
    supabase,
    userId,
    healthProfileContext,
    channel: "in_app",
    status: "sent",
    title,
    message,
    payload,
  });

  const push = pushEnabled
    ? await sendCoachPushNotifications({
        supabase,
        userId,
        payload: {
          title,
          message,
          url: "/companion?focus=autopilot",
          target: "autopilot",
        },
      })
    : {
        status: "skipped" as const,
        sent: 0,
        failed: 0,
        error: "Push notifications disabled",
      };

  await recordDelivery({
    supabase,
    userId,
    healthProfileContext,
    channel: "push",
    status: push.status,
    provider: "push",
    title,
    message,
    error: "error" in push ? push.error : undefined,
    payload: {
      ...payload,
      sent: push.sent,
      failed: push.failed,
    },
  });

  let email: MorningEmailResult = {
    status: "skipped" as const,
    provider: "resend" as const,
    error: "Email notifications disabled",
  };

  if (emailEnabled && user?.email && !quietHoursActive) {
    email = await sendCoachEmail({
      to: user.email,
      subject: title,
      text: message,
      html: buildEmailHtml({ title, message }),
    });
  } else if (!emailEnabled) {
    email.error = "Email notifications disabled";
  } else if (!user?.email) {
    email.error = "User email not found";
  } else if (quietHoursActive) {
    email.error = "Quiet hours active";
  }

  await recordDelivery({
    supabase,
    userId,
    healthProfileContext,
    channel: "email",
    status: email.status,
    provider: email.provider,
    providerMessageId: "providerMessageId" in email ? email.providerMessageId : undefined,
    title,
    message,
    error: "error" in email ? email.error : undefined,
    payload: {
      ...payload,
      quiet_hours: {
        active: quietHoursActive,
        start: prefs.quiet_hours_start,
        end: prefs.quiet_hours_end,
        timezone: prefs.timezone,
      },
    },
  });

  return { push, email };
}

async function getOrCreateAutopilotPreferences(
  supabase: SupabaseClient,
  userId: string,
  healthProfileContext: ActiveHealthProfileContext
) {
  const filter = getHealthSubjectFilter(healthProfileContext);
  const { data, error } = await supabase
    .from("autopilot_preferences")
    .select("*")
    .eq(filter.column, filter.value)
    .maybeSingle();

  if (error) {
    if (isMissingAutopilotTable(error)) return defaultAutopilotPreferences(userId);
    throw error;
  }

  if (data) return sanitizeAutopilotPreferences(userId, data);

  const next = defaultAutopilotPreferences(userId);
  const { data: created } = await supabase
    .from("autopilot_preferences")
    .insert({
      ...next,
      ...healthSubjectInsertFields(healthProfileContext),
    })
    .select("*")
    .maybeSingle();

  return sanitizeAutopilotPreferences(userId, created || next);
}

async function getLatestProtocol(
  supabase: SupabaseClient,
  userId: string,
  healthProfileContext: ActiveHealthProfileContext
): Promise<ProtocolRow | null> {
  const filter = getHealthSubjectFilter(healthProfileContext);
  const { data, error } = await supabase
    .from("optimization_protocols")
    .select("id,protocol,summary,focus_domains,status,created_at,updated_at")
    .eq(filter.column, filter.value)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as ProtocolRow | null) || null;
}

async function getExistingPlan(
  supabase: SupabaseClient,
  userId: string,
  today: string,
  healthProfileContext: ActiveHealthProfileContext
) {
  const filter = getHealthSubjectFilter(healthProfileContext);
  const { data, error } = await supabase
    .from("daily_execution_plans")
    .select("status,scheduled_event_ids")
    .eq(filter.column, filter.value)
    .eq("plan_date", today)
    .maybeSingle();

  if (error && !isMissingAutopilotTable(error)) throw error;
  return data as { status?: string; scheduled_event_ids?: string[] | null } | null;
}

async function upsertDailyExecutionPlan({
  supabase,
  userId,
  healthProfileContext,
  payload,
}: {
  supabase: SupabaseClient;
  userId: string;
  healthProfileContext: ActiveHealthProfileContext;
  payload: Record<string, unknown>;
}) {
  const filter = getHealthSubjectFilter(healthProfileContext);
  const updateResult = await supabase
    .from("daily_execution_plans")
    .update(payload)
    .eq(filter.column, filter.value)
    .eq("plan_date", String(payload.plan_date))
    .select("id,status,summary,plan_date")
    .maybeSingle();

  if (updateResult.error) return updateResult;
  if (updateResult.data) return updateResult;

  return supabase
    .from("daily_execution_plans")
    .insert({
      user_id: userId,
      ...healthSubjectInsertFields(healthProfileContext),
      ...payload,
    })
    .select("id,status,summary,plan_date")
    .single();
}

async function getRecentExecutionMemory(
  supabase: SupabaseClient,
  userId: string,
  healthProfileContext: ActiveHealthProfileContext
): Promise<ExecutionMemory> {
  const since = new Date();
  since.setDate(since.getDate() - 21);
  const filter = getHealthSubjectFilter(healthProfileContext);

  const { data, error } = await supabase
    .from("intervention_outcomes")
    .select("domain,action,outcome,success,created_at,measured_at")
    .eq(filter.column, filter.value)
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

function buildDailyPlan({
  executionMemory,
  preferenceMemory = defaultAgentPreferenceMemory(),
  preferences,
  protocol,
  today,
}: {
  executionMemory: ExecutionMemory;
  preferenceMemory?: AgentPreferenceMemory;
  preferences: AutopilotPreferences;
  protocol: ProtocolRow;
  today: string;
}) {
  const actions = [
    ...(protocol.protocol?.primary_protocol || []),
    ...buildLifeAutopilotAnchors(preferences),
  ]
    .map((action, actionIndex) => {
      const scope = classifyActionScope(action);
      return {
        ...action,
        actionIndex,
        scope,
        recommended_time: getRecommendedTime(action, scope, executionMemory, preferenceMemory),
        execution_mode: getExecutionMode(preferences, scope),
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
  const items = [...selectedItems, ...setupItems];
  const summary = items.length
    ? buildAdaptiveSummary(items.length, selectedItems, executionMemory, preferenceMemory)
    : "Aeonvera is ready to prepare your day once a protocol is active.";

  return {
    summary,
    plan: {
      date: today,
      mode: preferences.mode,
      summary,
      items,
      principles: [
        "Protect recovery before adding intensity.",
        "Use one focused morning decision instead of scattered task management.",
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
    },
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

  return `Aeonvera prepared ${itemCount} action${itemCount === 1 ? "" : "s"} for today: ${domains}.`;
}

function buildMorningMessage(items: Array<ProtocolAction & { recommended_time?: string }>) {
  const visible = items
    .slice(0, 3)
    .map((item) => `${item.domain || "Optimization"} at ${item.recommended_time || "smart time"}`)
    .join(", ");

  return visible
    ? `Good morning. Today is prepared: ${visible}. Open Aeonvera to accept, adjust, or pause.`
    : "Good morning. Aeonvera prepared your day. Open Aeonvera to accept, adjust, or pause.";
}

async function loadNotificationPreferences(
  supabase: SupabaseClient,
  userId: string,
  user?: { user_metadata?: { notification_preferences?: NotificationPreferences } } | null,
  healthProfileContext?: ActiveHealthProfileContext | null
) {
  const filter = healthProfileContext
    ? getHealthSubjectFilter(healthProfileContext)
    : { column: "user_id" as const, value: userId };
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("email_enabled,push_enabled,quiet_hours_start,quiet_hours_end,timezone")
    .eq(filter.column, filter.value)
    .maybeSingle();

  if (error && !isMissingNotificationTable(error)) {
    console.error("[Morning Autopilot Preference Error]", error.message);
  }

  return (
    (data as NotificationPreferences | null) ||
    user?.user_metadata?.notification_preferences ||
    {}
  );
}

async function recordDelivery({
  supabase,
  userId,
  healthProfileContext,
  channel,
  status,
  provider,
  providerMessageId,
  title,
  message,
  payload,
  error,
}: {
  supabase: SupabaseClient;
  userId: string;
  healthProfileContext: ActiveHealthProfileContext;
  channel: "email" | "push" | "in_app";
  status: "pending" | "sent" | "skipped" | "failed";
  provider?: string;
  providerMessageId?: string;
  title: string;
  message: string;
  payload: Record<string, unknown>;
  error?: string;
}) {
  const { error: deliveryError } = await supabase.from("notification_deliveries").insert({
    user_id: userId,
    ...healthSubjectInsertFields(healthProfileContext),
    channel,
    status,
    provider,
    provider_message_id: providerMessageId,
    title,
    message,
    payload,
    error,
    sent_at: status === "sent" ? new Date().toISOString() : null,
  });

  if (deliveryError && !isMissingNotificationTable(deliveryError)) {
    console.error("[Morning Autopilot Delivery Error]", deliveryError.message);
  }
}

function defaultAutopilotPreferences(userId: string): AutopilotPreferences {
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

function sanitizeAutopilotPreferences(
  userId: string,
  value: Partial<AutopilotPreferences>
) {
  const mode = normalizeMode(value.mode);

  return {
    user_id: userId,
    mode,
    calendar_enabled: value.calendar_enabled !== false,
    notifications_enabled: value.notifications_enabled !== false,
    auto_schedule_enabled:
      mode === "autopilot" || mode === "sovereign"
        ? value.auto_schedule_enabled === true
        : false,
    allow_training_blocks: value.allow_training_blocks !== false,
    allow_nutrition_blocks: value.allow_nutrition_blocks !== false,
    allow_recovery_blocks: value.allow_recovery_blocks !== false,
    allow_check_ins: value.allow_check_ins !== false,
    quiet_hours_start: sanitizeTime(value.quiet_hours_start) || "22:00",
    quiet_hours_end: sanitizeTime(value.quiet_hours_end) || "07:00",
    timezone:
      typeof value.timezone === "string" && value.timezone.length < 80
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

function classifyActionScope(action: ProtocolAction): ActionScope {
  const text = [action.domain, action.action, action.cadence, action.why]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/(measure|check|track|log|record|weigh|weight|metric|retest|lab|blood|hrv|resting heart|sleep score|recovery score|biomarker)/.test(text)) return "check_in";
  if (/(weekly|week|2x|3x|4x|twice|three times|session|sessions|zone 2|strength|resistance|meal prep|review)/.test(text)) return "week";
  if (/(daily|today|morning|evening|nightly|bedtime|wake|walk|hydrate|meal)/.test(text)) return "today";
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

function getExecutionMode(preferences: AutopilotPreferences, scope: ActionScope) {
  if (preferences.mode === "manual") return "manual";
  if (!preferences.calendar_enabled && !preferences.notifications_enabled) return "suggest";
  if (preferences.mode === "autopilot" || preferences.mode === "sovereign") {
    return preferences.auto_schedule_enabled ? "schedule" : "approve";
  }
  if (scope === "check_in" && preferences.notifications_enabled) return "notify";
  return preferences.mode === "approve" ? "approve" : "suggest";
}

function isAllowedByPreferences(
  preferences: AutopilotPreferences,
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

function buildLifeAutopilotAnchors(preferences: AutopilotPreferences): ProtocolAction[] {
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

function isQuietHoursActive(prefs: NotificationPreferences) {
  const start = parseTime(prefs.quiet_hours_start || "22:00");
  const end = parseTime(prefs.quiet_hours_end || "07:00");

  if (start === null || end === null || start === end) return false;

  const current = currentMinutesForTimezone(prefs.timezone || "UTC");
  return start < end ? current >= start && current < end : current >= start || current < end;
}

function currentMinutesForTimezone(timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
    const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
    return hour * 60 + minute;
  } catch {
    const now = new Date();
    return now.getUTCHours() * 60 + now.getUTCMinutes();
  }
}

function parseTime(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour > 23 || minute > 59 ? null : hour * 60 + minute;
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

function isMissingNotificationTable(error: { message?: string; code?: string }) {
  return (
    error.code === "PGRST205" ||
    error.message?.includes("notification_preferences") ||
    error.message?.includes("notification_deliveries") ||
    error.message?.includes("push_subscriptions") ||
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

function buildEmailHtml({ title, message }: { title: string; message: string }) {
  return `
    <div style="background:#050506;color:#f7f7f4;font-family:Inter,Arial,sans-serif;padding:32px">
      <div style="max-width:620px;margin:0 auto;border:1px solid rgba(218,220,224,.14);border-radius:14px;padding:28px;background:#111214">
        <p style="letter-spacing:.18em;text-transform:uppercase;color:#c4a969;font-size:11px;margin:0 0 18px">Aeonvera Autopilot</p>
        <h1 style="font-size:28px;font-weight:400;line-height:1.2;margin:0 0 18px">${escapeHtml(title)}</h1>
        <p style="color:#d8d8d2;line-height:1.7;white-space:pre-line">${escapeHtml(message)}</p>
      </div>
    </div>
  `;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
