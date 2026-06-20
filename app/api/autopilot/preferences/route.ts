import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccess } from "@/lib/auth/permissions";
import { getUserPlanForUsage } from "@/lib/usage/tierUsage";
import { storeSemanticMemory } from "@/lib/memory/semanticMemory";
import {
  frozenHealthProfilePayload,
  getHealthSubjectFilter,
  getRequestedHealthProfileId,
  healthSubjectInsertFields,
  resolveActiveHealthProfileContext,
  type ActiveHealthProfileContext,
} from "@/lib/health-profiles/activeHealthProfile";
import { rateLimitRequest } from "@/lib/security/rateLimit";

type AutopilotMode = "manual" | "suggest" | "approve" | "autopilot" | "sovereign";
type Intensity = "quiet" | "balanced" | "high_touch";
type MealRhythm = "two_meals" | "three_meals" | "protein_anchor" | "custom";
type MedicationBoundary = "never_medical" | "remind_only" | "clinician_supervised";

type ReminderDomains = {
  check_ins: boolean;
  fasting: boolean;
  food: boolean;
  hydration: boolean;
  recovery: boolean;
  sleep: boolean;
  sunlight: boolean;
  supplements: boolean;
  workouts: boolean;
};

type LifeAutopilotPreferences = {
  allow_check_ins: boolean;
  allow_nutrition_blocks: boolean;
  allow_recovery_blocks: boolean;
  allow_training_blocks: boolean;
  allowed_reminder_domains: ReminderDomains;
  auto_schedule_enabled: boolean;
  calendar_enabled: boolean;
  fasting_window_end: string;
  fasting_window_start: string;
  friction_tracking_enabled: boolean;
  hydration_target_ml: number;
  intensity: Intensity;
  meal_rhythm: MealRhythm;
  medication_boundary: MedicationBoundary;
  mode: AutopilotMode;
  notifications_enabled: boolean;
  quiet_hours_end: string;
  quiet_hours_start: string;
  sleep_window_end: string;
  sleep_window_start: string;
  streak_tracking_enabled: boolean;
  sunlight_target_minutes: number;
  supplement_reminders_enabled: boolean;
  timezone: string;
  training_days: string[];
  user_id: string;
  weekly_review_enabled: boolean;
};

const DEFAULT_DOMAINS: ReminderDomains = {
  check_ins: true,
  fasting: true,
  food: true,
  hydration: true,
  recovery: true,
  sleep: true,
  sunlight: true,
  supplements: false,
  workouts: true,
};

const DAYS = new Set(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const entitlement = await ensureAccess(admin, user.id);
    if (entitlement) return entitlement;
    const healthProfileContext = await resolveActiveHealthProfileContext({
      supabase: admin,
      loginUserId: user.id,
      requestedHealthProfileId: getRequestedHealthProfileId(request),
    });

    const [preferences, notificationPreferences, recentPlan, deliveries] = await Promise.all([
      getOrCreatePreferences(admin, user.id, healthProfileContext),
      getNotificationPreferences(admin, healthProfileContext),
      getRecentPlan(admin, user.id, healthProfileContext),
      getRecentDeliveries(admin, user.id, healthProfileContext),
    ]);

    return NextResponse.json({
      preferences,
      notificationPreferences,
      recentPlan,
      deliveries,
      recommendations: buildRecommendations(preferences),
      sovereign: buildSovereignSurface(preferences),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load Life Autopilot.";
    console.error(message, error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const limited = await rateLimitRequest(request, "autopilot-preferences-v2-update", 40, 60_000);
    if (limited) return limited;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const entitlement = await ensureAccess(admin, user.id);
    if (entitlement) return entitlement;
    const healthProfileContext = await resolveActiveHealthProfileContext({
      supabase: admin,
      loginUserId: user.id,
      requestedHealthProfileId: getRequestedHealthProfileId(request),
    });
    if (healthProfileContext.isFrozen) {
      return NextResponse.json(frozenHealthProfilePayload(), { status: 423 });
    }

    const body = await request.json().catch(() => ({}));
    const current = await getOrCreatePreferences(admin, user.id, healthProfileContext);
    const next = sanitizePreferences(user.id, { ...current, ...body });
    const patch = {
      ...toDatabasePatch(next),
      ...healthSubjectInsertFields(healthProfileContext),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await upsertAutopilotPreferences(
      admin,
      healthProfileContext,
      patch
    );

    if (error) {
      if (isMissingAutopilotColumns(error)) {
        return NextResponse.json(
          {
            error:
              "Apply supabase/migrations/20260617133000_life_autopilot_preferences.sql, then refresh Life Autopilot.",
          },
          { status: 409 }
        );
      }

      throw error;
    }

    await syncNotificationPreferences(admin, healthProfileContext, next);
    await recordPreferenceEvent(admin, user.id, healthProfileContext, next);
    await storeSemanticMemory({
      content: summarizeAutopilotPreferences(next),
      importance: 0.78,
      metadata: {
        intensity: next.intensity,
        mode: next.mode,
        storedBy: "autopilot_preferences",
      },
      sourceType: "autopilot_preferences",
      supabase: admin,
      title: "Life Autopilot preferences",
      healthProfileId: healthProfileContext.healthProfileId,
      userId: user.id,
    });

    return NextResponse.json({
      preferences: sanitizePreferences(user.id, data || next),
      recommendations: buildRecommendations(next),
      sovereign: buildSovereignSurface(next),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not save Life Autopilot.";
    console.error(message, error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

function summarizeAutopilotPreferences(preferences: LifeAutopilotPreferences) {
  const enabledDomains = Object.entries(preferences.allowed_reminder_domains)
    .filter(([, enabled]) => enabled)
    .map(([domain]) => domain.replace(/_/g, " "))
    .join(", ");

  return [
    `Coach intensity: ${preferences.intensity}`,
    `Automation mode: ${preferences.mode}`,
    `Quiet hours: ${preferences.quiet_hours_start}-${preferences.quiet_hours_end} (${preferences.timezone})`,
    `Fasting window: ${preferences.fasting_window_start}-${preferences.fasting_window_end}`,
    `Sleep window: ${preferences.sleep_window_start}-${preferences.sleep_window_end}`,
    `Meal rhythm: ${preferences.meal_rhythm}`,
    `Training days: ${preferences.training_days.join(", ") || "none selected"}`,
    `Hydration target: ${preferences.hydration_target_ml} ml`,
    `Sunlight target: ${preferences.sunlight_target_minutes} minutes`,
    `Medication boundary: ${preferences.medication_boundary}`,
    `Reminder domains: ${enabledDomains || "none"}`,
  ].join("\n");
}

async function ensureAccess(admin: ReturnType<typeof getSupabaseAdmin>, userId: string) {
  const subscription = await getUserPlanForUsage({ supabase: admin, userId });

  if (canAccess(subscription.plan, subscription.status, "autopilot_calendar")) {
    return null;
  }

  return NextResponse.json(
    {
      error: "Life Autopilot is included in Elite and Sovereign.",
      upgrade: {
        minimumPlan: "elite",
        message:
          "Upgrade to Elite to unlock proactive reminders, quiet hours, calendar execution, and behavior orchestration.",
      },
    },
    { status: 403 }
  );
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
    if (isMissingAutopilotColumns(error)) return defaultPreferences(userId);
    throw error;
  }

  if (data) return sanitizePreferences(userId, data);

  const next = {
    ...toDatabasePatch(defaultPreferences(userId)),
    ...healthSubjectInsertFields(healthProfileContext),
  };
  const { data: created, error: createError } = await upsertAutopilotPreferences(
    supabase,
    healthProfileContext,
    next
  );

  if (createError && !isMissingAutopilotColumns(createError)) throw createError;
  return sanitizePreferences(userId, created || next);
}

async function getNotificationPreferences(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  healthProfileContext: ActiveHealthProfileContext
) {
  const healthFilter = getHealthSubjectFilter(healthProfileContext);
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("email_enabled,push_enabled,quiet_hours_start,quiet_hours_end,timezone")
    .eq(healthFilter.column, healthFilter.value)
    .maybeSingle();

  if (error) return null;
  return data || null;
}

async function getRecentPlan(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  healthProfileContext: ActiveHealthProfileContext
) {
  const healthFilter = getHealthSubjectFilter(healthProfileContext);
  const { data, error } = await supabase
    .from("daily_execution_plans")
    .select("status,summary,plan_date,plan,updated_at")
    .eq(healthFilter.column, healthFilter.value)
    .order("plan_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data || null;
}

async function getRecentDeliveries(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  healthProfileContext: ActiveHealthProfileContext
) {
  const healthFilter = getHealthSubjectFilter(healthProfileContext);
  const { data, error } = await supabase
    .from("notification_deliveries")
    .select("channel,status,title,created_at")
    .eq(healthFilter.column, healthFilter.value)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) return [];
  return data || [];
}

async function syncNotificationPreferences(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  healthProfileContext: ActiveHealthProfileContext,
  prefs: LifeAutopilotPreferences
) {
  const payload = {
    email_enabled: prefs.notifications_enabled,
    push_enabled: prefs.notifications_enabled && prefs.intensity !== "quiet",
    quiet_hours_end: prefs.quiet_hours_end,
    quiet_hours_start: prefs.quiet_hours_start,
    timezone: prefs.timezone,
    updated_at: new Date().toISOString(),
    user_id: prefs.user_id,
    ...healthSubjectInsertFields(healthProfileContext),
  };
  const healthFilter = getHealthSubjectFilter(healthProfileContext);
  const { data: updated } = await supabase
    .from("notification_preferences")
    .update(payload)
    .eq(healthFilter.column, healthFilter.value)
    .select("id")
    .maybeSingle();

  if (!updated) {
    await supabase.from("notification_preferences").insert(payload);
  }
}

async function recordPreferenceEvent(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  healthProfileContext: ActiveHealthProfileContext,
  prefs: LifeAutopilotPreferences
) {
  await supabase.from("behavior_events").insert({
    user_id: userId,
    ...healthSubjectInsertFields(healthProfileContext),
    type: "life_autopilot",
    event_type: "life_autopilot_preferences_saved",
    domain: "Life Autopilot",
    action: "Updated behavior orchestration preferences",
    outcome: prefs.intensity,
    payload: {
      allowed_reminder_domains: prefs.allowed_reminder_domains,
      mode: prefs.mode,
      quiet_hours: {
        end: prefs.quiet_hours_end,
        start: prefs.quiet_hours_start,
      },
    },
  });
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

  if (updateError && !isMissingAutopilotColumns(updateError)) {
    return { data: null, error: updateError };
  }

  if (updated) return { data: updated, error: null };

  return await supabase
    .from("autopilot_preferences")
    .insert(payload)
    .select("*")
    .single();
}

function defaultPreferences(userId: string): LifeAutopilotPreferences {
  return {
    allow_check_ins: true,
    allow_nutrition_blocks: true,
    allow_recovery_blocks: true,
    allow_training_blocks: true,
    allowed_reminder_domains: DEFAULT_DOMAINS,
    auto_schedule_enabled: false,
    calendar_enabled: true,
    fasting_window_end: "08:00",
    fasting_window_start: "20:00",
    friction_tracking_enabled: true,
    hydration_target_ml: 2500,
    intensity: "balanced",
    meal_rhythm: "three_meals",
    medication_boundary: "never_medical",
    mode: "approve",
    notifications_enabled: true,
    quiet_hours_end: "07:00",
    quiet_hours_start: "22:00",
    sleep_window_end: "07:00",
    sleep_window_start: "22:30",
    streak_tracking_enabled: true,
    sunlight_target_minutes: 20,
    supplement_reminders_enabled: false,
    timezone: "UTC",
    training_days: ["Mon", "Wed", "Fri"],
    user_id: userId,
    weekly_review_enabled: true,
  };
}

function sanitizePreferences(
  userId: string,
  value: Partial<LifeAutopilotPreferences> & Record<string, unknown>
): LifeAutopilotPreferences {
  const mode = normalizeMode(value.mode);
  const intensity = normalizeIntensity(value.intensity);
  const domains = sanitizeDomains(value.allowed_reminder_domains);

  return {
    ...defaultPreferences(userId),
    allow_check_ins: value.allow_check_ins !== false && domains.check_ins,
    allow_nutrition_blocks:
      value.allow_nutrition_blocks !== false &&
      (domains.food || domains.fasting || domains.hydration || domains.supplements),
    allow_recovery_blocks:
      value.allow_recovery_blocks !== false && (domains.sleep || domains.recovery),
    allow_training_blocks: value.allow_training_blocks !== false && domains.workouts,
    allowed_reminder_domains: domains,
    auto_schedule_enabled:
      mode === "autopilot" || mode === "sovereign"
        ? value.auto_schedule_enabled === true
        : false,
    calendar_enabled: value.calendar_enabled !== false,
    fasting_window_end: sanitizeTime(value.fasting_window_end) || "08:00",
    fasting_window_start: sanitizeTime(value.fasting_window_start) || "20:00",
    friction_tracking_enabled: value.friction_tracking_enabled !== false,
    hydration_target_ml: clampNumber(value.hydration_target_ml, 500, 6000, 2500),
    intensity,
    meal_rhythm: normalizeMealRhythm(value.meal_rhythm),
    medication_boundary: normalizeMedicationBoundary(value.medication_boundary),
    mode,
    notifications_enabled: value.notifications_enabled !== false && intensity !== "quiet",
    quiet_hours_end: sanitizeTime(value.quiet_hours_end) || "07:00",
    quiet_hours_start: sanitizeTime(value.quiet_hours_start) || "22:00",
    sleep_window_end: sanitizeTime(value.sleep_window_end) || "07:00",
    sleep_window_start: sanitizeTime(value.sleep_window_start) || "22:30",
    streak_tracking_enabled: value.streak_tracking_enabled !== false,
    sunlight_target_minutes: clampNumber(value.sunlight_target_minutes, 0, 180, 20),
    supplement_reminders_enabled:
      value.supplement_reminders_enabled === true && domains.supplements,
    timezone:
      typeof value.timezone === "string" && value.timezone.length < 80
        ? value.timezone
        : "UTC",
    training_days: sanitizeTrainingDays(value.training_days),
    user_id: userId,
    weekly_review_enabled: value.weekly_review_enabled !== false,
  };
}

function toDatabasePatch(prefs: LifeAutopilotPreferences) {
  return {
    ...prefs,
    allow_check_ins: prefs.allow_check_ins,
    allow_nutrition_blocks: prefs.allow_nutrition_blocks,
    allow_recovery_blocks: prefs.allow_recovery_blocks,
    allow_training_blocks: prefs.allow_training_blocks,
  };
}

function buildRecommendations(prefs: LifeAutopilotPreferences) {
  const count = Object.values(prefs.allowed_reminder_domains).filter(Boolean).length;
  return [
    {
      label: "Reminder load",
      value:
        prefs.intensity === "quiet"
          ? "Quiet"
          : prefs.intensity === "high_touch"
            ? "High touch"
            : "Balanced",
      detail: `${count} behavior domain${count === 1 ? "" : "s"} active with quiet hours protected.`,
    },
    {
      label: "Today’s one move",
      value: prefs.allowed_reminder_domains.sleep ? "Protect sleep" : "Maintain rhythm",
      detail: `Aeonvera will anchor the day around your ${prefs.sleep_window_start} sleep wind-down unless recovery says otherwise.`,
    },
    {
      label: "Weekly review",
      value: prefs.weekly_review_enabled ? "Enabled" : "Paused",
      detail: prefs.weekly_review_enabled
        ? "Aeonvera can summarize streaks, friction, and what changed in your body this week."
        : "Weekly reflection is paused.",
    },
  ];
}

function buildSovereignSurface(prefs: LifeAutopilotPreferences) {
  return [
    {
      label: "White-glove onboarding",
      status: prefs.mode === "sovereign" ? "ready" : "available",
      detail: "Concierge import, setup review, and operating rhythm calibration.",
    },
    {
      label: "Quarterly strategy review",
      status: prefs.weekly_review_enabled ? "primed" : "needs weekly review",
      detail: "Roll up biomarkers, adherence, outcomes, and projection drift.",
    },
    {
      label: "Family profile path",
      status: "planned",
      detail: "Spouse and children access model belongs behind Sovereign controls.",
    },
    {
      label: "Concierge import status",
      status: prefs.calendar_enabled ? "connected workflow" : "needs calendar",
      detail: "Track labs, wearables, physician packets, and manual data clean-up.",
    },
  ];
}

function sanitizeDomains(value: unknown): ReminderDomains {
  const candidate =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<Record<keyof ReminderDomains, unknown>>)
      : {};

  return Object.fromEntries(
    Object.entries(DEFAULT_DOMAINS).map(([key, fallback]) => [
      key,
      typeof candidate[key as keyof ReminderDomains] === "boolean"
        ? candidate[key as keyof ReminderDomains]
        : fallback,
    ])
  ) as ReminderDomains;
}

function sanitizeTrainingDays(value: unknown) {
  if (!Array.isArray(value)) return ["Mon", "Wed", "Fri"];
  const days = value.filter((item): item is string => DAYS.has(String(item))).slice(0, 7);
  return days.length ? days : ["Mon", "Wed", "Fri"];
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

function normalizeIntensity(value: unknown): Intensity {
  return value === "quiet" || value === "high_touch" || value === "balanced"
    ? value
    : "balanced";
}

function normalizeMealRhythm(value: unknown): MealRhythm {
  return value === "two_meals" ||
    value === "protein_anchor" ||
    value === "custom" ||
    value === "three_meals"
    ? value
    : "three_meals";
}

function normalizeMedicationBoundary(value: unknown): MedicationBoundary {
  return value === "remind_only" ||
    value === "clinician_supervised" ||
    value === "never_medical"
    ? value
    : "never_medical";
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function sanitizeTime(value: unknown) {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value) ? value : "";
}

function isMissingAutopilotColumns(error: { message?: string; code?: string }) {
  return (
    error.code === "PGRST205" ||
    error.message?.includes("autopilot_preferences") ||
    error.message?.includes("allowed_reminder_domains") ||
    error.message?.includes("intensity") ||
    error.message?.includes("schema cache")
  );
}
