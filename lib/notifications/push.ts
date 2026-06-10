import type { SupabaseClient } from "@supabase/supabase-js";
import webPush from "web-push";

type PushResult =
  | { status: "sent"; sent: number; failed: number; error?: undefined }
  | { status: "skipped"; sent: number; failed: number; error: string }
  | { status: "failed"; sent: number; failed: number; error: string };

type SendableWebPushRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type PushPayload = {
  title: string;
  message: string;
  url?: string;
  actions?: string[];
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

  if (!publicKey || !privateKey) {
    return {
      status: "skipped",
      sent: 0,
      failed: 0,
      error: "Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY",
    };
  }

  webPush.setVapidDetails(subject, publicKey, privateKey);

  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId)
    .eq("platform", "web")
    .eq("enabled", true);

  if (error) {
    return {
      status: "failed",
      sent: 0,
      failed: 0,
      error: error.message,
    };
  }

  const subscriptions = (data || []).filter(
    (subscription): subscription is SendableWebPushRow =>
      Boolean(subscription.endpoint && subscription.p256dh && subscription.auth)
  );

  if (!subscriptions.length) {
    return {
      status: "skipped",
      sent: 0,
      failed: 0,
      error: "No active web push subscription registered",
    };
  }

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
            url: payload.url || "/dashboard",
            actions: payload.actions || [],
          })
        );
        sent++;
      } catch (error) {
        failed++;
        lastError = error instanceof Error ? error.message : "Push send failed";

        if (isExpiredPushSubscription(error)) {
          await supabase
            .from("push_subscriptions")
            .update({ enabled: false, updated_at: new Date().toISOString() })
            .eq("id", subscription.id);
        }
      }
    })
  );

  if (sent > 0) {
    return { status: "sent", sent, failed };
  }

  return {
    status: "failed",
    sent,
    failed,
    error: lastError || "Push send failed",
  };
}

function isExpiredPushSubscription(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const statusCode = "statusCode" in error ? Number(error.statusCode) : 0;
  return statusCode === 404 || statusCode === 410;
}
