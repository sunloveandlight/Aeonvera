import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { buildHealthState } from "@/lib/state/healthStateEngine";
import { runCoachRuntime } from "@/lib/runtime/coachRuntimeEngine";

export type AeonveraEventType =
  | "wearable.metric"
  | "user.login"
  | "user.assessment_completed"
  | "cron.daily_coach"
  | "health.state_updated"
  | "coach.trigger_check"
  | "system.tick";

export type AeonveraEvent = {
  userId: string;
  type: AeonveraEventType;
  timestamp: string;
  payload?: any;
};

/**
 * MAIN ENTRY
 */
export async function ingestEvent(event: AeonveraEvent) {
  await logEvent(event);

  switch (event.type) {
    case "wearable.metric":
      return handleWearableMetric(event);
    case "user.login":
      return handleUserLogin(event);
    case "user.assessment_completed":
      return handleAssessment(event);
    case "cron.daily_coach":
      return handleDailyCoach(event);
    case "system.tick":
      return handleSystemTick(event);
    default:
      return { status: "ignored", reason: "unknown_event_type" };
  }
}

/**
 * LOG ALL EVENTS
 */
async function logEvent(event: AeonveraEvent) {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from("aeonvera_events").insert({
    user_id: event.userId,
    type: event.type,
    payload: event.payload,
    created_at: event.timestamp,
  });

  if (error) {
    console.error("Event log failed:", error.message);
  }
}

/**
 * WEARABLE METRIC
 */
async function handleWearableMetric(event: AeonveraEvent) {
  const supabase = getSupabaseAdmin();
  const { metricName, value } = event.payload || {};

  if (!metricName) {
    return { status: "error", reason: "missing_metric" };
  }

  await supabase.from("wearable_metrics").insert({
    user_id: event.userId,
    metric_name: metricName,
    value,
    recorded_at: event.timestamp,
  });

  const { data } = await supabase
    .from("wearable_metrics")
    .select("*")
    .eq("user_id", event.userId)
    .order("recorded_at", { ascending: true })
    .limit(200);

  if (!data) return { status: "error", reason: "no_metrics" };

  const state = buildHealthState(
    data.map((m) => ({
      userId: m.user_id,
      metricName: m.metric_name,
      value: m.value,
      timestamp: m.recorded_at,
    }))
  );

  if (!state) return { status: "error", reason: "state_failed" };

  await supabase.from("health_states").insert({
    user_id: event.userId,
    state: state,
    updated_at: state.updatedAt,
  });

  const runtime = await runCoachRuntime({
    state,
    predictions: {},
    adaptiveWeights: {},
    timeOfDay: new Date().getHours(),
    lastInteractionMinutesAgo: 0,
    engagementScore: 0.5,
  });

  return {
    status: "processed",
    next: "runtime_executed",
    runtime,
  };
}

/**
 * USER LOGIN
 */
async function handleUserLogin(event: AeonveraEvent) {
  return {
    status: "processed",
    next: "check_recent_health_state",
    event,
  };
}

/**
 * ASSESSMENT
 */
async function handleAssessment(event: AeonveraEvent) {
  return {
    status: "processed",
    next: "generate_baseline_state",
    event,
  };
}

/**
 * DAILY COACH
 */
async function handleDailyCoach(event: AeonveraEvent) {
  return {
    status: "processed",
    next: "run_coach_pipeline",
    event,
  };
}

/**
 * SYSTEM TICK
 */
async function handleSystemTick(event: AeonveraEvent) {
  return {
    status: "processed",
    next: "evaluate_runtime_brain",
    event,
  };
}