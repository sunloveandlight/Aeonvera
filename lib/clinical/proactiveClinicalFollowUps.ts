import type { SupabaseClient } from "@supabase/supabase-js";
import { canAccess } from "@/lib/auth/permissions";
import { deliverUserNotification } from "@/lib/notifications/coachDelivery";
import { getUserPlanForUsage } from "@/lib/usage/tierUsage";

type ClinicalInsightRow = {
  id: string;
  source_question?: string | null;
  answer_summary?: string | null;
  domains?: string[] | null;
  concern_status?: string | null;
  confidence?: number | string | null;
  range_flags?: unknown;
  follow_up_questions?: unknown;
  recommended_actions?: unknown;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type NotificationRow = {
  created_at?: string | null;
  payload?: Record<string, unknown> | null;
};

type FollowUpStatus =
  | "sent"
  | "skipped"
  | "no_insights"
  | "recently_sent"
  | "missing_migration";

export async function runProactiveClinicalFollowUps({
  supabase,
  userId,
  force = false,
}: {
  supabase: SupabaseClient;
  userId: string;
  force?: boolean;
}): Promise<{
  status: FollowUpStatus;
  insightId?: string;
  delivery?: unknown;
  message?: string;
}> {
  const subscription = await getUserPlanForUsage({ supabase, userId });

  if (!canAccess(subscription.plan, subscription.status, "proactive_coach")) {
    return {
      status: "skipped",
      message: "Proactive clinical follow-ups are not included in this tier.",
    };
  }

  const insights = await loadOpenClinicalInsights(supabase, userId);

  if (insights.missingMigration) {
    return {
      status: "missing_migration",
      message: "Apply the clinical_insights migration to activate clinical follow-ups.",
    };
  }

  if (!insights.rows.length) {
    return { status: "no_insights", message: "No active clinical insights need follow-up." };
  }

  const recentNotifications = await loadRecentClinicalNotifications(supabase, userId);
  if (!force && hasUserLevelFollowUpToday(recentNotifications.rows)) {
    return {
      status: "recently_sent",
      message: "A clinical follow-up was already sent today.",
    };
  }

  const insight = chooseDueInsight(insights.rows, recentNotifications.rows, force);
  if (!insight) {
    return {
      status: "recently_sent",
      message: "All active clinical insights were followed up recently.",
    };
  }

  const followUp = buildClinicalFollowUp(insight);
  const delivery = await deliverUserNotification({
    supabase,
    userId,
    title: followUp.title,
    message: followUp.message,
    actions: followUp.actions,
    url: "/companion?focus=clinical",
    target: "clinical_follow_up",
    payload: {
      type: "clinical_follow_up",
      clinical_insight_id: insight.id,
      domains: insight.domains || [],
      concern_status: insight.concern_status || "active",
      source: "proactive_clinical_follow_up",
    },
  });

  await markInsightFollowedUp({
    supabase,
    insight,
    question: followUp.primaryQuestion,
  });

  return {
    status: "sent",
    insightId: insight.id,
    delivery,
    message: followUp.message,
  };
}

async function loadOpenClinicalInsights(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("clinical_insights")
    .select(
      "id,source_question,answer_summary,domains,concern_status,confidence,range_flags,follow_up_questions,recommended_actions,metadata,created_at,updated_at"
    )
    .eq("user_id", userId)
    .in("concern_status", ["active", "unresolved", "monitoring"])
    .order("updated_at", { ascending: false })
    .limit(8);

  if (error) {
    if (isMissingClinicalTable(error)) {
      return { rows: [] as ClinicalInsightRow[], missingMigration: true };
    }

    console.error("[Clinical Follow-up Load Error]", error.message);
    return { rows: [] as ClinicalInsightRow[], missingMigration: false };
  }

  return {
    rows: ((data || []) as ClinicalInsightRow[]).filter((insight) => insight.id),
    missingMigration: false,
  };
}

async function loadRecentClinicalNotifications(supabase: SupabaseClient, userId: string) {
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
    if (!isMissingNotificationTable(error)) {
      console.error("[Clinical Follow-up Notification Load Error]", error.message);
    }

    return { rows: [] as NotificationRow[] };
  }

  return {
    rows: ((data || []) as NotificationRow[]).filter(
      (row) => row.payload?.type === "clinical_follow_up"
    ),
  };
}

function hasUserLevelFollowUpToday(notifications: NotificationRow[]) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  return notifications.some((notification) => {
    if (!notification.created_at) return false;
    return new Date(notification.created_at).getTime() >= startOfDay.getTime();
  });
}

function chooseDueInsight(
  insights: ClinicalInsightRow[],
  notifications: NotificationRow[],
  force: boolean
) {
  if (force) return insights[0] || null;

  const cooldownMs = 3 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  return (
    insights.find((insight) => {
      const lastFollowUp = notifications.find(
        (notification) => notification.payload?.clinical_insight_id === insight.id
      );

      if (!lastFollowUp?.created_at) return true;
      return now - new Date(lastFollowUp.created_at).getTime() > cooldownMs;
    }) || null
  );
}

function buildClinicalFollowUp(insight: ClinicalInsightRow) {
  const domains = insight.domains?.length ? insight.domains.slice(0, 3) : ["clinical signal"];
  const primaryQuestion = firstString(insight.follow_up_questions) || fallbackQuestion(domains);
  const action = firstRecommendedAction(insight.recommended_actions);
  const status = insight.concern_status === "monitoring" ? "monitoring" : "open";
  const summary = insight.answer_summary || "Aeonvera is continuing a clinical reasoning thread.";
  const title = `Aeonvera clinical follow-up: ${domains.join(" / ")}`;
  const actionLine = action
    ? `\n\nSuggested next step: ${action}`
    : "\n\nSuggested next step: answer the follow-up so Aeonvera can tighten the protocol.";
  const safetyLine =
    "\n\nIf this involves severe, sudden, or worsening symptoms, seek medical care rather than waiting for optimization guidance.";

  return {
    title,
    primaryQuestion,
    message: `Your ${domains.join(", ")} signal is still ${status}. ${summary}\n\nFollow-up: ${primaryQuestion}${actionLine}${safetyLine}`,
    actions: [primaryQuestion, action].filter((item): item is string => Boolean(item)),
  };
}

function firstString(value: unknown) {
  if (!Array.isArray(value)) return "";
  const first = value.find((item) => typeof item === "string" && item.trim());
  return typeof first === "string" ? first.trim() : "";
}

function firstRecommendedAction(value: unknown) {
  if (!Array.isArray(value)) return "";

  for (const item of value) {
    if (typeof item === "string" && item.trim()) return item.trim();
    if (item && typeof item === "object" && "action" in item) {
      const action = item.action;
      if (typeof action === "string" && action.trim()) return action.trim();
    }
  }

  return "";
}

function fallbackQuestion(domains: string[]) {
  const domainText = domains.join(", ");
  return `What changed in ${domainText} since the last Aeonvera review?`;
}

async function markInsightFollowedUp({
  supabase,
  insight,
  question,
}: {
  supabase: SupabaseClient;
  insight: ClinicalInsightRow;
  question: string;
}) {
  const metadata = {
    ...(isRecord(insight.metadata) ? insight.metadata : {}),
    last_follow_up_at: new Date().toISOString(),
    last_follow_up_question: question,
  };

  const { error } = await supabase
    .from("clinical_insights")
    .update({
      concern_status: insight.concern_status === "active" ? "monitoring" : insight.concern_status,
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq("id", insight.id);

  if (error && !isMissingClinicalTable(error)) {
    console.error("[Clinical Follow-up Update Error]", error.message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isMissingClinicalTable(error: { message?: string; code?: string }) {
  return (
    error.code === "PGRST205" ||
    error.message?.includes("clinical_insights") ||
    error.message?.includes("schema cache")
  );
}

function isMissingNotificationTable(error: { message?: string; code?: string }) {
  return (
    error.code === "PGRST205" ||
    error.message?.includes("notification_deliveries") ||
    error.message?.includes("schema cache")
  );
}
