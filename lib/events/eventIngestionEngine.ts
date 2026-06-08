/**
 * Aeonvera — Event Ingestion Engine (V1)
 * --------------------------------------
 * Converts all external/internal actions into structured intelligence events.
 */

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
 * All system inputs go through here
 */
export async function ingestEvent(event: AeonveraEvent) {
  switch (event.type) {
    /**
     * WEARABLE DATA ARRIVES
     */
    case "wearable.metric":
      return handleWearableMetric(event);

    /**
     * USER ACTIONS
     */
    case "user.login":
      return handleUserLogin(event);

    case "user.assessment_completed":
      return handleAssessment(event);

    /**
     * SYSTEM EVENTS
     */
    case "cron.daily_coach":
      return handleDailyCoach(event);

    case "system.tick":
      return handleSystemTick(event);

    default:
      return {
        status: "ignored",
        reason: "unknown_event_type",
      };
  }
}

/**
 * WEARABLE METRIC EVENT
 */
async function handleWearableMetric(event: AeonveraEvent) {
  // Example payload:
  // { metricName, value }

  return {
    status: "processed",
    next: "update_health_state",
    event,
  };
}

/**
 * USER LOGIN EVENT
 */
async function handleUserLogin(event: AeonveraEvent) {
  return {
    status: "processed",
    next: "check_recent_health_state",
    event,
  };
}

/**
 * ASSESSMENT COMPLETED
 */
async function handleAssessment(event: AeonveraEvent) {
  return {
    status: "processed",
    next: "generate_baseline_state",
    event,
  };
}

/**
 * DAILY COACH CRON
 */
async function handleDailyCoach(event: AeonveraEvent) {
  return {
    status: "processed",
    next: "run_coach_pipeline",
    event,
  };
}

/**
 * SYSTEM TICK (heartbeat loop)
 */
async function handleSystemTick(event: AeonveraEvent) {
  return {
    status: "processed",
    next: "evaluate_runtime_brain",
    event,
  };
}