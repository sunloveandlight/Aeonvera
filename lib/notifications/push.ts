import type { SupabaseClient } from "@supabase/supabase-js";
import webPush from "web-push";

type PushResult =
  | { status: "sent"; sent: number; failed: number; error?: undefined }
  | { status: "skipped"; sent: number; failed: number; error: string }
  | { status: "failed"; sent: number; failed: number; error: string };

type SendableWebPushRow = {
  id: string;
  platform: "web";
  endpoint: string;
  p256dh: string;
  auth: string;
};

type SendableNativePushRow = {
  id: string;
  platform: "ios" | "android";
  token: string;
};

type PushSubscriptionRow = {
  id: string;
  platform: "web" | "ios" | "android";
  endpoint?: string | null;
  p256dh?: string | null;
  auth?: string | null;
  token?: string | null;
};

type PushPayload = {
  title: string;
  message: string;
  url?: string;
  actions?: string[];
  alertId?: string;
  target?: "coach_inbox" | "dashboard" | "companion" | "autopilot" | "clinical_follow_up";
};

export async function sendCoachPushNotifications({
  supabase,
  userId,
  payload,
}: {
  supabase: SupabaseClient;
  userId: string;
  payload: PushPayload;
}): Promise<PushResult> {
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:support@aeonvera.app";

  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id, platform, endpoint, p256dh, auth, token")
    .eq("user_id", userId)
    .eq("enabled", true);

  if (error) {
    return {
      status: "failed",
      sent: 0,
      failed: 0,
      error: error.message,
    };
  }

  const rows = (data || []) as PushSubscriptionRow[];
  const webSubscriptions = rows.filter(
    (subscription): subscription is SendableWebPushRow =>
      subscription.platform === "web" &&
      Boolean(subscription.endpoint && subscription.p256dh && subscription.auth)
  );
  const nativeSubscriptions = rows.filter(
    (subscription): subscription is SendableNativePushRow =>
      (subscription.platform === "ios" || subscription.platform === "android") &&
      isExpoPushToken(subscription.token)
  );

  if (!webSubscriptions.length && !nativeSubscriptions.length) {
    return {
      status: "skipped",
      sent: 0,
      failed: 0,
      error: "No active push subscription registered",
    };
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  if (webSubscriptions.length) {
    if (!publicKey || !privateKey) {
      failed += webSubscriptions.length;
      errors.push("Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY");
    } else {
      webPush.setVapidDetails(subject, publicKey, privateKey);
      const webResult = await sendWebPushSubscriptions({
        supabase,
        subscriptions: webSubscriptions,
        payload,
      });
      sent += webResult.sent;
      failed += webResult.failed;
      if (webResult.error) errors.push(webResult.error);
    }
  }

  if (nativeSubscriptions.length) {
    const nativeResult = await sendExpoPushSubscriptions({
      supabase,
      subscriptions: nativeSubscriptions,
      payload,
    });
    sent += nativeResult.sent;
    failed += nativeResult.failed;
    if (nativeResult.error) errors.push(nativeResult.error);
  }

  if (sent > 0) {
    return { status: "sent", sent, failed };
  }

  return {
    status: "failed",
    sent,
    failed,
    error: errors.join("; ") || "Push send failed",
  };
}

async function sendWebPushSubscriptions({
  supabase,
  subscriptions,
  payload,
}: {
  supabase: SupabaseClient;
  subscriptions: SendableWebPushRow[];
  payload: PushPayload;
}) {
  let sent = 0;
  let failed = 0;
  let lastError = "";

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          JSON.stringify({
            title: payload.title,
            body: payload.message,
            url: payload.url || "/companion?focus=coach",
            actions: payload.actions || [],
            alertId: payload.alertId,
            target: payload.target || "coach_inbox",
          })
        );
        sent++;
      } catch (error) {
        failed++;
        lastError = error instanceof Error ? error.message : "Web push send failed";

        if (isExpiredPushSubscription(error)) {
          await disablePushSubscription(supabase, subscription.id);
        }
      }
    })
  );

  return { sent, failed, error: lastError };
}

async function sendExpoPushSubscriptions({
  supabase,
  subscriptions,
  payload,
}: {
  supabase: SupabaseClient;
  subscriptions: SendableNativePushRow[];
  payload: PushPayload;
}) {
  let sent = 0;
  let failed = 0;
  let lastError = "";

  for (const chunk of chunkArray(subscriptions, 100)) {
    try {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          chunk.map((subscription) => ({
            to: subscription.token,
            title: payload.title,
            body: payload.message,
            sound: "default",
            categoryId: "coach-message",
            channelId: "coach-updates",
            data: {
              url: payload.url || "/companion?focus=coach",
              actions: payload.actions || [],
              alertId: payload.alertId,
              target: payload.target || "coach_inbox",
            },
          }))
        ),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        failed += chunk.length;
        lastError = result?.errors?.[0]?.message || "Expo push send failed";
        continue;
      }

      const tickets = Array.isArray(result?.data) ? result.data : [result?.data];
      for (let index = 0; index < chunk.length; index++) {
        const ticket = tickets[index];

        if (ticket?.status === "ok") {
          sent++;
          continue;
        }

        failed++;
        lastError = ticket?.message || "Expo push ticket failed";

        if (ticket?.details?.error === "DeviceNotRegistered") {
          await disablePushSubscription(supabase, chunk[index].id);
        }
      }
    } catch (error) {
      failed += chunk.length;
      lastError = error instanceof Error ? error.message : "Expo push send failed";
    }
  }

  return { sent, failed, error: lastError };
}

function isExpoPushToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (/^ExpoPushToken\[[\w-]+\]$/.test(value) ||
      /^ExponentPushToken\[[\w-]+\]$/.test(value))
  );
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function disablePushSubscription(supabase: SupabaseClient, id: string) {
  await supabase
    .from("push_subscriptions")
    .update({ enabled: false, updated_at: new Date().toISOString() })
    .eq("id", id);
}

function isExpiredPushSubscription(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const statusCode = "statusCode" in error ? Number(error.statusCode) : 0;
  return statusCode === 404 || statusCode === 410;
}
