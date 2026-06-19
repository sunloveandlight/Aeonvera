"use client";

import { useEffect, useState } from "react";
import { Toggle } from "@/components/ui/forms";

type Preferences = {
  email_enabled: boolean;
  push_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  timezone: string;
  source?: "table" | "auth_metadata" | "sleep_schedule";
};

type PushDetail = {
  enabled?: boolean;
  sent?: number;
  failed?: number;
  error?: string | null;
};

const DEFAULT_PREFS: Preferences = {
  email_enabled: true,
  push_enabled: false,
  quiet_hours_start: "22:00",
  quiet_hours_end: "07:00",
  timezone: "UTC",
  source: "sleep_schedule",
};

export default function NotificationPreferencesPanel() {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFS);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetch("/api/notifications/preferences", { credentials: "include" })
      .then((response) => response.json())
      .then((data) => {
        if (data.preferences) {
          setPreferences({
            email_enabled: data.preferences.email_enabled !== false,
            push_enabled: data.preferences.push_enabled === true,
            quiet_hours_start:
              data.preferences.quiet_hours_start || DEFAULT_PREFS.quiet_hours_start,
            quiet_hours_end:
              data.preferences.quiet_hours_end || DEFAULT_PREFS.quiet_hours_end,
            timezone: data.preferences.timezone || DEFAULT_PREFS.timezone,
            source: data.preferences.source || DEFAULT_PREFS.source,
          });
        }
      })
      .catch(() => setMessage("Notification preferences could not be loaded."));
  }, []);

  async function save(next: Preferences) {
    try {
      setSaving(true);
      setMessage(null);
      setPreferences(next);

      const response = await fetch("/api/notifications/preferences", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Preferences failed to save.");
      }

      setMessage("Coach delivery preferences saved.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Preferences failed to save."
      );
    } finally {
      setSaving(false);
    }
  }

  async function enableBrowserPush(next: Preferences) {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      throw new Error("Push notifications are not supported in this browser.");
    }

    const configResponse = await fetch("/api/notifications/push-subscriptions", {
      credentials: "include",
    });
    const config = await configResponse.json();

    if (!config.publicKey) {
      throw new Error("Push notifications need VAPID keys configured first.");
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      throw new Error("Browser notification permission was not granted.");
    }

    const registration = await navigator.serviceWorker.register(
      "/aeonvera-push-worker.js"
    );
    const existingSubscription =
      await registration.pushManager.getSubscription();
    const subscription =
      existingSubscription ||
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.publicKey),
      }));

    const serialized = subscription.toJSON();
    const response = await fetch("/api/notifications/push-subscriptions", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: "web",
        subscription: serialized,
        endpoint: serialized.endpoint,
        keys: serialized.keys,
        device_name: navigator.userAgent,
        enabled: true,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Push subscription failed.");
    }

    await save(next);
  }

  async function disableBrowserPush(next: Preferences) {
    await fetch("/api/notifications/push-subscriptions", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    }).catch(() => null);

    await save(next);
  }

  async function handlePushPreference(pushEnabled: boolean) {
    const next = { ...preferences, push_enabled: pushEnabled };

    try {
      setSaving(true);
      setMessage(null);
      setPreferences(next);

      if (pushEnabled) {
        await enableBrowserPush(next);
        setMessage("Push notifications are connected for this browser.");
        return;
      }

      await disableBrowserPush(next);
      setMessage("Push notifications disabled.");
    } catch (error) {
      setPreferences(preferences);
      setMessage(
        error instanceof Error ? error.message : "Push preference failed to save."
      );
    } finally {
      setSaving(false);
    }
  }

  async function sendTestCoachMessage() {
    try {
      setTesting(true);
      setMessage(null);

      const response = await fetch("/api/notifications/test-coach", {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Test coach message failed.");
      }

      const emailState = data.delivery?.email || "skipped";
      const pushState = data.delivery?.push || "skipped";
      const pushDetail = data.delivery?.push_detail as PushDetail | undefined;
      const pushCounts =
        pushDetail && typeof pushDetail.sent === "number"
          ? ` ${pushDetail.sent} sent, ${pushDetail.failed || 0} failed.`
          : "";
      const pushError = pushDetail?.error ? ` ${pushDetail.error}.` : "";
      setMessage(
        `Test coach message created. Email: ${emailState}. Push: ${pushState}.${pushCounts}${pushError}`
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Test coach message failed."
      );
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="executive-panel rounded-lg p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <p className="micro-label">Phase 3 Delivery</p>
          <h2 className="mt-3 text-2xl font-light tracking-tight text-white/80">
            Proactive coach contact
          </h2>
          <p className="mt-2 text-sm leading-7 text-white/45">
            Daily coach outputs can now be delivered beyond the dashboard.
            Email is active when Resend is configured; browser push is active
            when VAPID keys are configured. iOS and Android will plug into this
            same preference system.
          </p>
          {message && (
            <p className="mt-3 text-sm leading-6 royal-text">{message}</p>
          )}
        </div>

        <div className="grid min-w-full gap-3 sm:min-w-[24rem]">
          <div className="executive-panel-soft rounded-lg p-4">
            <Toggle
              enabled={preferences.email_enabled}
              onChange={(emailEnabled) =>
                save({ ...preferences, email_enabled: emailEnabled })
              }
              label="Email coach updates"
            />
          </div>
          <div className="executive-panel-soft rounded-lg p-4">
            <Toggle
              enabled={preferences.push_enabled}
              onChange={handlePushPreference}
              label="Push notification delivery"
            />
          </div>
          <p className="av-eyebrow text-white/25">
            {saving ? "Saving" : "Quiet hours"} {preferences.quiet_hours_start}-
            {preferences.quiet_hours_end}
          </p>
          <p className="text-xs leading-5 text-white/35">
            Synced from latest sleep duration. Add wearable sleep data for a more
            accurate quiet window.
          </p>
          <button
            type="button"
            onClick={sendTestCoachMessage}
            disabled={saving || testing}
            className="av-eyebrow premium-action-secondary inline-flex h-10 items-center justify-center rounded-md px-4 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {testing ? "Sending test" : "Send test coach message"}
          </button>
        </div>
      </div>
    </div>
  );
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index++) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}
