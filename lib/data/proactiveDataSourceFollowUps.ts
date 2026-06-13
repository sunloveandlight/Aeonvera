import type { SupabaseClient } from "@supabase/supabase-js";
import { canAccess } from "@/lib/auth/permissions";
import { deliverUserNotification } from "@/lib/notifications/coachDelivery";
import { getUserPlanForUsage } from "@/lib/usage/tierUsage";
import { buildDataSourceIntelligence } from "./dataSourceIntelligence";

type FollowUpStatus =
  | "sent"
  | "skipped"
  | "healthy"
  | "recently_sent"
  | "missing_tables";

type NotificationRow = {
  created_at?: string | null;
  payload?: Record<string, unknown> | null;
};

export async function runProactiveDataSourceFollowUps({
  force = false,
  supabase,
  userId,
}: {
  force?: boolean;
  supabase: SupabaseClient;
  userId: string;
}): Promise<{
  status: FollowUpStatus;
  delivery?: unknown;
  message?: string;
  score?: number;
}> {
  const subscription = await getUserPlanForUsage({ supabase, userId });

  if (!canAccess(subscription.plan, subscription.status, "proactive_coach")) {
    return {
      status: "skipped",
      message: "Proactive source follow-ups are included in Elite and Sovereign.",
    };
  }

  const sourceData = await loadSourceData(supabase, userId);
  if (sourceData.missingRequiredTable) {
    return {
      status: "missing_tables",
      message: "Apply source data migrations before enabling proactive data-source follow-ups.",
    };
  }

  const intelligence = buildDataSourceIntelligence({
    appleRows: sourceData.wearableRows.filter((row) => row.provider === "apple"),
    calendarConnected: sourceData.calendarConnected,
    connectedProviders: sourceData.connectedProviders,
    healthState: sourceData.healthState,
    labRows: sourceData.labRows,
    wearableRows: sourceData.wearableRows,
  });

  const prompt = intelligence.prompts.find((item) => item.priority === "high") || intelligence.prompts[0];

  if (!prompt || intelligence.score >= 85) {
    return {
      status: "healthy",
      message: "Data source layer is current enough for proactive intelligence.",
      score: intelligence.score,
    };
  }

  const recentNotifications = await loadRecentDataSourceNotifications(supabase, userId);
  if (!force && hasSentToday(recentNotifications.rows)) {
    return {
      status: "recently_sent",
      message: "A data-source follow-up was already sent today.",
      score: intelligence.score,
    };
  }

  const delivery = await deliverUserNotification({
    supabase,
    userId,
    title: `Aeonvera signal: ${prompt.title}`,
    message: buildMessage(prompt.body, intelligence.score),
    actions: [prompt.actionLabel],
    url: prompt.href,
    target: "data_sources",
    payload: {
      type: "data_source_follow_up",
      source: "proactive_data_source_follow_up",
      score: intelligence.score,
      status: intelligence.status,
      prompt_title: prompt.title,
      priority: prompt.priority,
    },
  });

  return {
    status: "sent",
    delivery,
    message: prompt.body,
    score: intelligence.score,
  };
}

async function loadSourceData(supabase: SupabaseClient, userId: string) {
  const [wearableResult, connectionResult, labResult, healthStateResult, calendarResult] =
    await Promise.all([
      supabase
        .from("wearable_metrics")
        .select("provider,recorded_at")
        .eq("user_id", userId)
        .order("recorded_at", { ascending: false })
        .limit(80),
      supabase
        .from("wearable_connections")
        .select("provider,status")
        .eq("user_id", userId)
        .eq("status", "connected")
        .limit(8),
      supabase
        .from("lab_biomarkers")
        .select("canonical_key,measured_at")
        .eq("user_id", userId)
        .order("measured_at", { ascending: false })
        .limit(32),
      supabase
        .from("health_states")
        .select("updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("calendar_connections")
        .select("status")
        .eq("user_id", userId)
        .eq("status", "connected")
        .limit(1),
    ]);

  const requiredErrors = [
    wearableResult.error,
    labResult.error,
    healthStateResult.error,
  ].filter((error): error is NonNullable<typeof wearableResult.error> => Boolean(error));
  const missingRequiredTable = requiredErrors.some(isMissingSourceTable);

  if (requiredErrors.length && !missingRequiredTable) {
    requiredErrors.forEach((error) => console.error("[Data Source Follow-up Load Error]", error.message));
  }

  if (connectionResult.error && !isMissingSourceTable(connectionResult.error)) {
    console.error("[Data Source Connection Load Error]", connectionResult.error.message);
  }

  if (calendarResult.error && !isMissingSourceTable(calendarResult.error)) {
    console.error("[Data Source Calendar Load Error]", calendarResult.error.message);
  }

  return {
    missingRequiredTable,
    wearableRows: wearableResult.error ? [] : wearableResult.data || [],
    connectedProviders: (connectionResult.error ? [] : connectionResult.data || [])
      .map((row) => row.provider)
      .filter((provider): provider is string => typeof provider === "string"),
    labRows: labResult.error ? [] : labResult.data || [],
    healthState: healthStateResult.error ? null : healthStateResult.data || null,
    calendarConnected: !calendarResult.error && Boolean(calendarResult.data?.length),
  };
}

async function loadRecentDataSourceNotifications(supabase: SupabaseClient, userId: string) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("notification_deliveries")
    .select("created_at,payload")
    .eq("user_id", userId)
    .eq("channel", "in_app")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    if (!isMissingSourceTable(error)) {
      console.error("[Data Source Notification Load Error]", error.message);
    }

    return { rows: [] as NotificationRow[] };
  }

  return {
    rows: ((data || []) as NotificationRow[]).filter(
      (row) => row.payload?.type === "data_source_follow_up"
    ),
  };
}

function hasSentToday(notifications: NotificationRow[]) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  return notifications.some((notification) => {
    if (!notification.created_at) return false;
    return new Date(notification.created_at).getTime() >= startOfDay.getTime();
  });
}

function buildMessage(body: string, score: number) {
  return `${body}\n\nCurrent source readiness: ${score}%. Aeonvera will keep coaching from available data, but this signal should be tightened so recommendations stay personal and current.`;
}

function isMissingSourceTable(error: { message?: string; code?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message?.includes("schema cache") ||
    error.message?.includes("wearable_metrics") ||
    error.message?.includes("wearable_connections") ||
    error.message?.includes("lab_biomarkers") ||
    error.message?.includes("health_states") ||
    error.message?.includes("calendar_connections") ||
    error.message?.includes("notification_deliveries")
  );
}
