import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ingestWearableMetrics } from "@/lib/wearables/ingestWearableMetrics";
import { runCoachRuntime } from "@/lib/runtime/coachRuntimeEngine";
import type { WearableProvider } from "@/lib/wearables/types";

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
  const { provider = "manual", metricName, value } = event.payload || {};

  if (!metricName) {
    return { status: "error", reason: "missing_metric" };
  }

  if (!["oura", "apple", "whoop"].includes(provider)) {
    return { status: "error", reason: "unsupported_provider" };
  }

  const result = await ingestWearableMetrics({
    supabase,
    userId: event.userId,
    provider: provider as WearableProvider,
    metrics: [{
      metricName,
      value: Number(value),
      timestamp: event.timestamp,
    }],
  });

  if (!result.state) return { status: "error", reason: "state_failed" };

  const runtime = await runCoachRuntime({
    state: result.state,
    predictions: {},
    adaptiveWeights: {},
    timeOfDay: new Date().getHours(),
    lastInteractionMinutesAgo: 0,
    engagementScore: 0.5,
  });

  return {
    status: "processed",
    next: "runtime_executed",
    ingestion: result,
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
