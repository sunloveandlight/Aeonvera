import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

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

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const today = toDateKey(new Date());
    const preferences = await getOrCreatePreferences(admin, user.id);
    const protocol = await getLatestProtocol(admin, user.id);
    const prepared = buildDailyPlan({ protocol, preferences, today });
    const { data: existingPlan, error: existingError } = await admin
      .from("daily_execution_plans")
      .select("status,accepted_at,skipped_at,scheduled_event_ids")
      .eq("user_id", user.id)
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

    const { data, error } = await admin
      .from("daily_execution_plans")
      .upsert(
        {
          user_id: user.id,
          protocol_id: protocol?.id || null,
          plan_date: today,
          status,
          autopilot_mode: preferences.mode,
          summary: prepared.summary,
          plan: prepared.plan,
          scheduled_event_ids: existingPlan?.scheduled_event_ids || [],
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,plan_date" }
      )
      .select("*")
      .single();

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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const admin = getSupabaseAdmin();
    const current = await getOrCreatePreferences(admin, user.id);
    const next = sanitizePreferences(user.id, { ...current, ...body });

    const { data, error } = await admin
      .from("autopilot_preferences")
      .upsert(
        {
          ...next,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select("*")
      .single();

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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
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
      .eq("user_id", user.id)
      .eq("plan_date", today)
      .select("*")
      .maybeSingle();

    if (error) {
      throw error;
    }

    await admin.from("behavior_events").insert({
      user_id: user.id,
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
    return NextResponse.json({ error: message }, { status: 500 });
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

async function getOrCreatePreferences(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string
) {
  const { data, error } = await supabase
    .from("autopilot_preferences")
    .select("*")
    .eq("user_id", userId)
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

  const next = defaultPreferences(userId);
  const { data: created } = await supabase
    .from("autopilot_preferences")
    .insert(next)
    .select("*")
    .maybeSingle();

  return sanitizePreferences(userId, created || next);
}

async function getLatestProtocol(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string
): Promise<ProtocolRow | null> {
  const { data, error } = await supabase
    .from("optimization_protocols")
    .select("id,protocol,summary,focus_domains,status,created_at,updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as ProtocolRow | null) || null;
}

function buildDailyPlan({
  preferences,
  protocol,
  today,
}: {
  preferences: PreferencesRow;
  protocol: ProtocolRow | null;
  today: string;
}) {
  const actions = (protocol?.protocol?.primary_protocol || [])
    .map((action, actionIndex) => {
      const scope = classifyActionScope(action);
      return {
        ...action,
        actionIndex,
        scope,
        recommended_time: getRecommendedTime(action, scope),
        execution_mode: getExecutionMode(preferences, action, scope),
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
  const itemCount = selectedItems.length + setupItems.length;
  const summary = itemCount
    ? `Aeonvera prepared ${itemCount} action${itemCount === 1 ? "" : "s"} for today: ${selectedItems
        .slice(0, 2)
        .map((action) => action.domain || "Optimization")
        .join(" and ")}.`
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
    ],
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

function getRecommendedTime(action: ProtocolAction, scope: ActionScope) {
  const text = [action.domain, action.action, action.cadence, action.why]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/(sleep|bedtime|wind down|evening|night|recovery|relax|caffeine)/.test(text)) {
    return "20:30";
  }

  if (/(wake|morning|sunlight|weigh|weight|hrv|blood pressure|glucose|fasting)/.test(text)) {
    return "08:00";
  }

  if (/(zone 2|cardio|walk|steps|run|training|workout|strength|resistance|mobility)/.test(text)) {
    return "17:30";
  }

  if (/(meal|nutrition|protein|supplement|creatine|hydration|hydrate|food)/.test(text)) {
    return "12:30";
  }

  if (/(journal|meditation|breath|stress|mindfulness|reflection)/.test(text)) {
    return "19:30";
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
