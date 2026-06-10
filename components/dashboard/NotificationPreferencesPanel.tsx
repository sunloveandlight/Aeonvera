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
            Email is active when Resend is configured; push registration is ready
            for web, iOS, and Android clients.
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
              onChange={(pushEnabled) =>
                save({ ...preferences, push_enabled: pushEnabled })
              }
              label="Push notification delivery"
            />
          </div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/25">
            {saving ? "Saving" : "Quiet hours"} {preferences.quiet_hours_start}-
            {preferences.quiet_hours_end}
          </p>
          <p className="text-xs leading-5 text-white/35">
            Synced from latest sleep duration. Add wearable sleep data for a more
            accurate quiet window.
          </p>
        </div>
      </div>
    </div>
  );
}
