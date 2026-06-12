import type { SupabaseClient } from "@supabase/supabase-js";
import { sendCoachEmail } from "@/lib/notifications/email";
import { sendCoachPushNotifications } from "@/lib/notifications/push";

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
  timezone: string;
};

type NotificationPreferences = {
  email_enabled?: boolean | null;
  push_enabled?: boolean | null;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  timezone?: string | null;
};

type MorningEmailResult =
  | { status: "sent"; provider: "resend"; providerMessageId?: string }
  | { status: "skipped"; provider: "resend"; error: string }
  | { status: "failed"; provider: "resend"; error: string };

export async function runMorningAutopilotBrief({
  supabase,
  userId,
}: {
  supabase: SupabaseClient;
  userId: string;
}) {
  const today = toDateKey(new Date());
  const [autopilotPreferences, protocol, userResult] = await Promise.all([
    getOrCreateAutopilotPreferences(supabase, userId),
    getLatestProtocol(supabase, userId),
    supabase.auth.admin.getUserById(userId),
  ]);

  if (autopilotPreferences.mode === "manual") {
    return { status: "skipped", reason: "Autopilot mode is manual" };
  }

  if (!protocol?.protocol?.primary_protocol?.length) {
    return { status: "skipped", reason: "No active optimization protocol" };
  }

  const prepared = buildDailyPlan({
    preferences: autopilotPreferences,
    protocol,
    today,
  });

  if (!prepared.plan.items.length) {
    return { status: "skipped", reason: "No eligible actions for today" };
  }

  const existingPlan = await getExistingPlan(supabase, userId, today);
  const alreadyAccepted =
    existingPlan?.status === "accepted" || existingPlan?.status === "auto_scheduled";
  const status = alreadyAccepted ? existingPlan.status : "prepared";

  const { data: plan, error: planError } = await supabase
    .from("daily_execution_plans")
    .upsert(
      {
        user_id: userId,
        protocol_id: protocol.id,
        plan_date: today,
        status,
        autopilot_mode: autopilotPreferences.mode,
        summary: prepared.summary,
        plan: prepared.plan,
        scheduled_event_ids: existingPlan?.scheduled_event_ids || [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,plan_date" }
    )
    .select("id,status,summary,plan_date")
    .single();

  if (planError) {
    if (isMissingAutopilotTable(planError)) {
      return { status: "skipped", reason: "Autopilot migration is not applied" };
    }

    throw planError;
  }

  const delivery = await deliverMorningPlan({
    supabase,
    userId,
    user: userResult.data.user,
    title: "Aeonvera Autopilot: Today is prepared",
    message: buildMorningMessage(prepared.plan.items),
    planId: plan.id,
    planSummary: prepared.summary,
  });

  await supabase.from("behavior_events").insert({
    user_id: userId,
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
  user,
  title,
  message,
  planId,
  planSummary,
}: {
  supabase: SupabaseClient;
  userId: string;
  user?: { email?: string; user_metadata?: { notification_preferences?: NotificationPreferences } } | null;
  title: string;
  message: string;
  planId: string;
  planSummary: string;
}) {
  const prefs = await loadNotificationPreferences(supabase, userId, user);
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
  userId: string
) {
  const { data, error } = await supabase
    .from("autopilot_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingAutopilotTable(error)) return defaultAutopilotPreferences(userId);
    throw error;
  }

  if (data) return sanitizeAutopilotPreferences(userId, data);

  const next = defaultAutopilotPreferences(userId);
  const { data: created } = await supabase
    .from("autopilot_preferences")
    .insert(next)
    .select("*")
    .maybeSingle();

  return sanitizeAutopilotPreferences(userId, created || next);
}

async function getLatestProtocol(
  supabase: SupabaseClient,
  userId: string
): Promise<ProtocolRow | null> {
  const { data, error } = await supabase
    .from("optimization_protocols")
    .select("id,protocol,summary,focus_domains,status,created_at,updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as ProtocolRow | null) || null;
}

async function getExistingPlan(supabase: SupabaseClient, userId: string, today: string) {
  const { data, error } = await supabase
    .from("daily_execution_plans")
    .select("status,scheduled_event_ids")
    .eq("user_id", userId)
    .eq("plan_date", today)
    .maybeSingle();

  if (error && !isMissingAutopilotTable(error)) throw error;
  return data as { status?: string; scheduled_event_ids?: string[] | null } | null;
}

function buildDailyPlan({
  preferences,
  protocol,
  today,
}: {
  preferences: AutopilotPreferences;
  protocol: ProtocolRow;
  today: string;
}) {
  const actions = (protocol.protocol?.primary_protocol || [])
    .map((action, actionIndex) => {
      const scope = classifyActionScope(action);
      return {
        ...action,
        actionIndex,
        scope,
        recommended_time: getRecommendedTime(action, scope),
        execution_mode: getExecutionMode(preferences, scope),
      };
    })
    .filter((action) => action.action)
    .filter((action) => isAllowedByPreferences(preferences, action))
    .sort((a, b) => actionPriority(b) - actionPriority(a));

  const todayItems = actions
    .filter((action) => action.scope === "today" || action.scope === "check_in")
    .slice(0, 4);
  const setupItems = actions
    .filter((action) => action.scope === "week" || action.scope === "later")
    .slice(0, 2);
  const selectedItems = todayItems.length ? todayItems : actions.slice(0, 3);
  const items = [...selectedItems, ...setupItems];
  const summary = items.length
    ? `Aeonvera prepared ${items.length} action${items.length === 1 ? "" : "s"} for today.`
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
      ],
    },
  };
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
  user?: { user_metadata?: { notification_preferences?: NotificationPreferences } } | null
) {
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("email_enabled,push_enabled,quiet_hours_start,quiet_hours_end,timezone")
    .eq("user_id", userId)
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

function getRecommendedTime(action: ProtocolAction, scope: ActionScope) {
  const text = [action.domain, action.action, action.cadence, action.why]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/(sleep|bedtime|wind down|evening|night|recovery|relax|caffeine)/.test(text)) return "20:30";
  if (/(wake|morning|sunlight|weigh|weight|hrv|blood pressure|glucose|fasting)/.test(text)) return "08:00";
  if (/(zone 2|cardio|walk|steps|run|training|workout|strength|resistance|mobility)/.test(text)) return "17:30";
  if (/(meal|nutrition|protein|supplement|creatine|hydration|hydrate|food)/.test(text)) return "12:30";
  if (/(journal|meditation|breath|stress|mindfulness|reflection)/.test(text)) return "19:30";
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
  if (!preferences.allow_check_ins && action.scope === "check_in") return false;
  if (!preferences.allow_training_blocks && /(training|workout|strength|resistance|zone 2|cardio|movement)/.test(text)) return false;
  if (!preferences.allow_nutrition_blocks && /(nutrition|meal|protein|food|supplement|hydration)/.test(text)) return false;
  if (!preferences.allow_recovery_blocks && /(sleep|recovery|stress|breath|meditation|relax)/.test(text)) return false;
  return true;
}

function actionPriority(action: ProtocolAction & { scope: ActionScope }) {
  const impact = action.impact === "high" ? 4 : action.impact === "medium" ? 2 : 1;
  const scope = action.scope === "today" ? 4 : action.scope === "check_in" ? 3 : action.scope === "week" ? 2 : 1;
  return impact + scope;
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
