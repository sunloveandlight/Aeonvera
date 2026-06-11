import type { SupabaseClient } from "@supabase/supabase-js";
import type { JarvisMessage } from "@/lib/voice/jarvisResponseEngine";
import type { LongevityAlert } from "@/lib/coach/longevityCoach";
import { sendCoachEmail } from "./email";
import { sendCoachPushNotifications } from "./push";

type StoredAlert = LongevityAlert & {
  id?: string;
};

type NotificationPreferences = {
  email_enabled?: boolean | null;
  push_enabled?: boolean | null;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  timezone?: string | null;
};

export async function deliverCoachNotifications({
  supabase,
  userId,
  alerts,
  jarvis,
  memoryTags = [],
}: {
  supabase: SupabaseClient;
  userId: string;
  alerts: StoredAlert[];
  jarvis: JarvisMessage;
  memoryTags?: string[];
}) {
  if (!alerts.length || !jarvis.message) {
    return { email: "skipped", push: "skipped" };
  }

  const [{ data: profile }, userResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.auth.admin.getUserById(userId),
  ]);

  const prefs = await loadPreferences(supabase, userId, userResult.data.user);
  const emailEnabled = prefs.email_enabled !== false;
  const pushEnabled = prefs.push_enabled === true;
  const quietHoursActive = isQuietHoursActive(prefs);
  const email = userResult.data.user?.email;
  const primaryAlert = alerts[0];
  const title = buildTitle(primaryAlert);
  const message = buildMessage(jarvis, primaryAlert);

  await recordDelivery({
    supabase,
    userId,
    alertId: primaryAlert.id,
    channel: "in_app",
    status: "sent",
    title,
    message,
    payload: { actions: jarvis.actions, tone: jarvis.tone, coach_memory_tags: memoryTags },
  });

  if (emailEnabled && email && !quietHoursActive) {
    const emailResult = await sendCoachEmail({
      to: email,
      subject: title,
      text: message,
      html: buildEmailHtml({
        displayName: profile?.display_name,
        title,
        message,
        actions: jarvis.actions,
      }),
    });

    await recordDelivery({
      supabase,
      userId,
      alertId: primaryAlert.id,
      channel: "email",
      status: emailResult.status,
      provider: emailResult.provider,
      providerMessageId:
        "providerMessageId" in emailResult
          ? emailResult.providerMessageId
          : undefined,
      title,
      message,
      error: "error" in emailResult ? emailResult.error : undefined,
      payload: { actions: jarvis.actions, tone: jarvis.tone, coach_memory_tags: memoryTags },
    });
  } else {
    const skippedReason = !email
      ? "User email not found"
      : !emailEnabled
      ? "Email notifications disabled"
      : "Quiet hours active";

    await recordDelivery({
      supabase,
      userId,
      alertId: primaryAlert.id,
      channel: "email",
      status: "skipped",
      title,
      message,
      error: skippedReason,
      payload: {
        actions: jarvis.actions,
        tone: jarvis.tone,
        coach_memory_tags: memoryTags,
        quiet_hours: {
          active: quietHoursActive,
          start: prefs.quiet_hours_start,
          end: prefs.quiet_hours_end,
          timezone: prefs.timezone,
        },
      },
    });
  }

  const pushResult = pushEnabled
    ? await sendCoachPushNotifications({
        supabase,
        userId,
        payload: {
          title,
          message,
          url: "/companion?focus=coach",
          actions: jarvis.actions,
          alertId: primaryAlert.id,
          target: "coach_inbox",
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
    alertId: primaryAlert.id,
    channel: "push",
    status: pushResult.status,
    provider: "web-push",
    title,
    message,
    error: "error" in pushResult ? pushResult.error : undefined,
    payload: {
      actions: jarvis.actions,
      tone: jarvis.tone,
      coach_memory_tags: memoryTags,
      sent: pushResult.sent,
      failed: pushResult.failed,
    },
  });

  return {
    in_app: "sent",
    email: emailEnabled && !quietHoursActive ? "processed" : "skipped",
    push: pushResult.status,
  };
}

async function recordDelivery({
  supabase,
  userId,
  alertId,
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
  alertId?: string;
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
    alert_id: alertId,
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
    console.error("[Notification Delivery Error]", deliveryError.message);
  }
}

async function loadPreferences(
  supabase: SupabaseClient,
  userId: string,
  user?: { user_metadata?: { notification_preferences?: NotificationPreferences } } | null
) {
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("email_enabled, push_enabled, quiet_hours_start, quiet_hours_end, timezone")
    .eq("user_id", userId)
    .maybeSingle();

  if (error && !isMissingNotificationTable(error)) {
    console.error("[Notification Preference Error]", error.message);
  }

  return (
    (data as NotificationPreferences | null) ||
    user?.user_metadata?.notification_preferences ||
    {}
  );
}

function isQuietHoursActive(prefs: NotificationPreferences) {
  const start = parseTime(prefs.quiet_hours_start || "22:00");
  const end = parseTime(prefs.quiet_hours_end || "07:00");

  if (start === null || end === null || start === end) return false;

  const current = currentMinutesForTimezone(prefs.timezone || "UTC");

  if (start < end) {
    return current >= start && current < end;
  }

  return current >= start || current < end;
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

  if (hour > 23 || minute > 59) return null;

  return hour * 60 + minute;
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

function buildTitle(alert: StoredAlert) {
  return `Aeonvera coach: ${alert.title}`;
}

function buildMessage(jarvis: JarvisMessage, alert: StoredAlert) {
  const actions = jarvis.actions.length
    ? `\n\nRecommended action: ${jarvis.actions[0]}`
    : "";

  return `${jarvis.message}\n\n${alert.message}\n${alert.recommendation}${actions}`;
}

function buildEmailHtml({
  displayName,
  title,
  message,
  actions,
}: {
  displayName?: string | null;
  title: string;
  message: string;
  actions: string[];
}) {
  const greeting = displayName ? `${displayName},` : "Your coach update";
  const actionItems = actions
    .map((action) => `<li style="margin:8px 0;color:#d8d8d2">${escapeHtml(action)}</li>`)
    .join("");

  return `
    <div style="background:#050506;color:#f7f7f4;font-family:Inter,Arial,sans-serif;padding:32px">
      <div style="max-width:620px;margin:0 auto;border:1px solid rgba(218,220,224,.14);border-radius:14px;padding:28px;background:#111214">
        <p style="letter-spacing:.18em;text-transform:uppercase;color:#c4a969;font-size:11px;margin:0 0 18px">Aeonvera</p>
        <h1 style="font-size:28px;font-weight:400;line-height:1.2;margin:0 0 18px">${escapeHtml(title)}</h1>
        <p style="color:#d8d8d2;line-height:1.7;margin:0 0 18px">${escapeHtml(greeting)}</p>
        <p style="color:#d8d8d2;line-height:1.7;white-space:pre-line">${escapeHtml(message)}</p>
        ${
          actionItems
            ? `<ul style="padding-left:20px;margin:22px 0 0">${actionItems}</ul>`
            : ""
        }
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
