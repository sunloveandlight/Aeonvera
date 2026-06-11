"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Bell, Brain, CalendarClock, Dna, MessageCircle, Sparkles } from "lucide-react";
import PageContainer from "@/components/ui/PageContainer";
import NotificationPreferencesPanel from "@/components/dashboard/NotificationPreferencesPanel";
import { supabase } from "@/lib/supabase/client";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type StandaloneNavigator = Navigator & {
  standalone?: boolean;
};

type TwinPayload = {
  intelligence?: {
    summary: string;
    modelState: string;
    confidence: number;
    nextMove: {
      title: string;
      detail: string;
      href: string;
    };
  };
  counts?: Record<string, number>;
};

type ProtocolAction = {
  domain?: string;
  action?: string;
  why?: string;
  cadence?: string;
  impact?: "low" | "medium" | "high";
};

type ActionScope = "today" | "week" | "check_in" | "later";

type Protocol = {
  id: string;
  summary?: string | null;
  focus_domains?: string[] | null;
  status?: string | null;
  created_at?: string;
  protocol?: {
    summary?: string;
    primary_protocol?: ProtocolAction[];
    coach_message?: string;
  } | null;
};

type CoachMessage = {
  id: string;
  title: string;
  message: string;
  created_at?: string;
};

type CalendarStatus = {
  connected: boolean;
  migrationRequired?: boolean;
  message?: string;
  connection?: {
    provider: string;
    status: string;
    calendar_id?: string;
    connected_at?: string;
  } | null;
};

export default function CompanionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [twin, setTwin] = useState<TwinPayload | null>(null);
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([]);
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null);
  const [calendarMessage, setCalendarMessage] = useState<string | null>(null);
  const [schedulingCalendar, setSchedulingCalendar] = useState(false);
  const [schedulingActionKey, setSchedulingActionKey] = useState<string | null>(null);
  const [scheduledActionKeys, setScheduledActionKeys] = useState<Record<string, boolean>>({});
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installState, setInstallState] = useState({
    standalone: false,
    serviceWorker: false,
    push: false,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadCompanion() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login?mode=signin");
        return;
      }

      try {
        const [twinResponse, protocolResponse, coachResponse, calendarResponse] = await Promise.all([
          fetch("/api/digital-twin/timeline", { credentials: "include" }),
          fetch("/api/optimization/protocols", { credentials: "include" }),
          fetch("/api/notifications/deliveries", { credentials: "include" }),
          fetch("/api/calendar/google/status", { credentials: "include" }),
        ]);
        const [twinData, protocolData, coachData, calendarData] = await Promise.all([
          twinResponse.json(),
          protocolResponse.json(),
          coachResponse.json(),
          calendarResponse.json(),
        ]);

        if (!twinResponse.ok) throw new Error(twinData.error || "Companion could not load.");

        if (!cancelled) {
          setTwin(twinData);
          setProtocols(protocolData.protocols || []);
          setCoachMessages(coachData.notifications || []);
          setCalendarStatus(calendarResponse.ok ? calendarData : null);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Companion could not load.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadCompanion();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as StandaloneNavigator).standalone === true;
    setInstallState({
      standalone,
      serviceWorker: "serviceWorker" in navigator,
      push: "PushManager" in window,
    });

    function handleInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    function handleInstalled() {
      setInstallPrompt(null);
      setInstallState((current) => ({ ...current, standalone: true }));
    }

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const protocol = protocols[0];
  const protocolFocus = useMemo(
    () => protocol?.focus_domains?.slice(0, 3).join(" / ") || "Optimization",
    [protocol]
  );
  const protocolActions = protocol?.protocol?.primary_protocol || [];

  async function installCompanion() {
    if (!installPrompt) return;

    await installPrompt.prompt();
    await installPrompt.userChoice.catch(() => null);
    setInstallPrompt(null);
  }

  async function scheduleProtocolToCalendar() {
    if (!protocol) {
      setCalendarMessage("Generate an optimization protocol before scheduling.");
      return;
    }

    if (!calendarStatus?.connected) {
      window.location.href = "/api/calendar/google/connect";
      return;
    }

    setSchedulingCalendar(true);
    setCalendarMessage(null);

    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + 1);
    scheduledFor.setHours(9, 0, 0, 0);
    const scheduledLocal = toLocalDateTimePayload(scheduledFor);

    try {
      const response = await fetch("/api/calendar/google/events", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Aeonvera protocol: ${protocolFocus}`,
          description:
            protocol.summary ||
            "Aeonvera scheduled this protocol block from your companion view.",
          action: protocol.summary || protocolFocus,
          actionScope: "week",
          protocolId: protocol.id,
          scheduledFor: scheduledFor.toISOString(),
          scheduledLocal,
          durationMinutes: 45,
          recurrence: "weekly",
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Calendar event could not be scheduled.");
      }

      setCalendarMessage("Protocol scheduled in Google Calendar.");
    } catch (error) {
      setCalendarMessage(
        error instanceof Error ? error.message : "Calendar event could not be scheduled."
      );
    } finally {
      setSchedulingCalendar(false);
    }
  }

  async function scheduleActionToCalendar(action: ProtocolAction, actionIndex: number) {
    if (!protocol || !action.action) return;

    if (!calendarStatus?.connected) {
      window.location.href = "/api/calendar/google/connect";
      return;
    }

    const actionKey = `${protocol.id}:${actionIndex}:${action.action}`;
    const scope = classifyActionScope(action);
    const scheduledFor = getActionScheduleDate(scope, actionIndex);
    const scheduledLocal = toLocalDateTimePayload(scheduledFor);
    const recurrence = getActionRecurrence(scope, action);

    setSchedulingActionKey(actionKey);
    setCalendarMessage(null);

    try {
      const response = await fetch("/api/calendar/google/events", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Aeonvera: ${action.action}`,
          description: action.why || protocol.summary || "Aeonvera scheduled this action.",
          action: action.action,
          actionScope: scope,
          protocolId: protocol.id,
          scheduledFor: scheduledFor.toISOString(),
          scheduledLocal,
          durationMinutes: getActionDuration(scope, action),
          recurrence,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Action could not be scheduled.");
      }

      setScheduledActionKeys((current) => ({ ...current, [actionKey]: true }));
      setCalendarMessage("Action scheduled in Google Calendar.");
    } catch (error) {
      setCalendarMessage(
        error instanceof Error ? error.message : "Action could not be scheduled."
      );
    } finally {
      setSchedulingActionKey(null);
    }
  }

  return (
    <PageContainer>
      <div className="py-14">
        <div className="mb-9 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="micro-label mb-5">Mobile Companion</p>
            <h1 className="max-w-4xl text-5xl font-light leading-[1.04] text-white md:text-6xl">
              Today&apos;s healthspan operating view.
            </h1>
          </div>
          <Link
            href="/digital-twin"
            className="premium-action inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium"
          >
            Digital Twin <ArrowRight size={16} />
          </Link>
        </div>

        {loading ? (
          <div className="executive-panel rounded-lg p-8">
            <p className="micro-label">Loading companion</p>
          </div>
        ) : message ? (
          <div className="executive-panel rounded-lg p-8">
            <p className="micro-label">Unavailable</p>
            <p className="mt-4 text-sm leading-7 text-white/50">{message}</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <Link
                href={twin?.intelligence?.nextMove.href || "/optimization"}
                className="quiet-lift executive-panel block rounded-lg p-6 transition hover:border-white/[0.14] md:p-7"
              >
                <div className="mb-6 flex items-center justify-between gap-3">
                  <p className="micro-label">Today</p>
                  <Sparkles size={18} className="royal-text" />
                </div>
                <h2 className="text-3xl font-light leading-tight text-white">
                  {twin?.intelligence?.nextMove.title || "Run your next protocol"}
                </h2>
                <p className="mt-5 text-sm leading-7 text-white/48">
                  {twin?.intelligence?.nextMove.detail ||
                    "Aeonvera is ready to turn the next recommendation into a tracked action."}
                </p>
              </Link>

              <div className="executive-panel rounded-lg p-6 md:p-7">
                <div className="mb-6 flex items-center justify-between gap-3">
                  <p className="micro-label">Twin Status</p>
                  <Dna size={18} className="royal-text" />
                </div>
                <div className="flex items-end gap-3">
                  <p className="text-5xl font-light leading-none text-white">
                    {twin?.intelligence?.confidence || 0}
                  </p>
                  <p className="mb-1 text-xs uppercase tracking-[0.14em] text-white/28">
                    confidence
                  </p>
                </div>
                <p className="mt-5 text-sm leading-7 text-white/48">
                  {twin?.intelligence?.summary ||
                    "Your model is assembling from assessments, labs, protocols, coach signals, and wearable data."}
                </p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <InstallCompanionCard
                installState={installState}
                canPrompt={Boolean(installPrompt)}
                onInstall={() => void installCompanion()}
              />
              <CompanionCard
                icon={CalendarClock}
                label="Active Protocol"
                title={protocolFocus}
                detail={protocol?.summary || "Generate a protocol to activate daily execution."}
                href="/optimization"
              />
              <CalendarAutomationCard
                connected={calendarStatus?.connected === true}
                migrationRequired={calendarStatus?.migrationRequired === true}
                message={calendarMessage || calendarStatus?.message}
                scheduling={schedulingCalendar}
                onConnect={() => {
                  window.location.href = "/api/calendar/google/connect";
                }}
                onSchedule={() => void scheduleProtocolToCalendar()}
              />
            </div>

            <CompanionCard
              icon={MessageCircle}
              label="Coach Inbox"
              title={coachMessages[0]?.title || "No coach message yet"}
              detail={coachMessages[0]?.message || "Daily coach messages will appear here as the system learns."}
              href="/dashboard"
            />

            <ProtocolActionsCalendarPanel
              actions={protocolActions}
              connected={calendarStatus?.connected === true}
              protocolId={protocol?.id}
              scheduledActionKeys={scheduledActionKeys}
              schedulingActionKey={schedulingActionKey}
              onConnect={() => {
                window.location.href = "/api/calendar/google/connect";
              }}
              onSchedule={(action, index) => void scheduleActionToCalendar(action, index)}
            />

            <NotificationPreferencesPanel />
          </div>
        )}
      </div>
    </PageContainer>
  );
}

function toLocalDateTimePayload(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function ProtocolActionsCalendarPanel({
  actions,
  connected,
  onConnect,
  onSchedule,
  protocolId,
  scheduledActionKeys,
  schedulingActionKey,
}: {
  actions: ProtocolAction[];
  connected: boolean;
  onConnect: () => void;
  onSchedule: (action: ProtocolAction, index: number) => void;
  protocolId?: string;
  scheduledActionKeys: Record<string, boolean>;
  schedulingActionKey: string | null;
}) {
  if (!actions.length) {
    return null;
  }

  return (
    <div className="executive-panel rounded-lg p-6 md:p-7">
      <div className="mb-6 flex items-center justify-between gap-3">
        <p className="micro-label">Action Scheduling</p>
        <CalendarClock size={18} className="royal-text" />
      </div>
      <div className="space-y-4">
        {actions.slice(0, 6).map((action, index) => {
          const scope = classifyActionScope(action);
          const actionKey = `${protocolId}:${index}:${action.action}`;
          const scheduled = scheduledActionKeys[actionKey];
          const scheduling = schedulingActionKey === actionKey;

          return (
            <div
              key={actionKey}
              className="rounded-lg border border-white/[0.07] bg-black/15 p-4"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-white/[0.035] px-2 py-1 text-[8px] uppercase tracking-[0.14em] text-[#dabc73]/80">
                      {scopeLabel(scope)}
                    </span>
                    {action.cadence && (
                      <span className="rounded-md bg-white/[0.025] px-2 py-1 text-[8px] uppercase tracking-[0.14em] text-white/32">
                        {action.cadence}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-light leading-snug text-white/86">
                    {action.action || "Protocol action"}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-white/42">
                    {action.why || "Schedule this action into your calendar."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={connected ? () => onSchedule(action, index) : onConnect}
                  disabled={scheduling || scheduled}
                  className="premium-action inline-flex h-10 shrink-0 items-center justify-center rounded-md px-4 text-[10px] uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {scheduled
                    ? "Scheduled"
                    : scheduling
                      ? "Scheduling"
                      : connected
                        ? "Schedule"
                        : "Connect"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function classifyActionScope(action: ProtocolAction): ActionScope {
  const text = [action.domain, action.action, action.cadence, action.why]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    /(measure|check|track|log|record|weigh|weight|metric|retest|lab|blood|hrv|resting heart|sleep score|recovery score|biomarker)/.test(
      text
    )
  ) {
    return "check_in";
  }

  if (
    /(weekly|week|2x|3x|4x|twice|three times|session|sessions|zone 2|strength|resistance|meal prep|review)/.test(
      text
    )
  ) {
    return "week";
  }

  if (/(daily|today|morning|evening|nightly|bedtime|wake|walk|hydrate|meal)/.test(text)) {
    return "today";
  }

  return "later";
}

function getActionScheduleDate(scope: ActionScope, actionIndex: number) {
  const date = new Date();

  if (scope === "today") {
    date.setDate(date.getDate() + 1);
    date.setHours(8 + Math.min(actionIndex, 3), 0, 0, 0);
    return date;
  }

  if (scope === "check_in") {
    date.setDate(date.getDate() + 1);
    date.setHours(8, 0, 0, 0);
    return date;
  }

  if (scope === "week") {
    date.setDate(date.getDate() + 2 + (actionIndex % 3));
    date.setHours(9 + (actionIndex % 2), 0, 0, 0);
    return date;
  }

  date.setDate(date.getDate() + 3);
  date.setHours(11, 0, 0, 0);
  return date;
}

function getActionDuration(scope: ActionScope, action: ProtocolAction) {
  const text = [action.domain, action.action, action.cadence].join(" ").toLowerCase();
  if (scope === "check_in") return 15;
  if (/strength|zone 2|training|workout|session|resistance/.test(text)) return 60;
  if (/walk|meal|nutrition|sleep|wind/.test(text)) return 30;
  return 45;
}

function getActionRecurrence(scope: ActionScope, action: ProtocolAction) {
  const text = [action.domain, action.action, action.cadence, action.why]
    .join(" ")
    .toLowerCase();
  if (scope === "today" || /daily|nightly|morning|evening/.test(text)) return "daily";
  if (scope === "week" || /weekly|week|session|sessions/.test(text)) return "weekly";
  return "none";
}

function scopeLabel(scope: ActionScope) {
  if (scope === "check_in") return "Check-in";
  if (scope === "week") return "This week";
  if (scope === "later") return "Later";
  return "Today";
}

function InstallCompanionCard({
  installState,
  canPrompt,
  onInstall,
}: {
  installState: {
    standalone: boolean;
    serviceWorker: boolean;
    push: boolean;
  };
  canPrompt: boolean;
  onInstall: () => void;
}) {
  const title = installState.standalone
    ? "Installed"
    : canPrompt
    ? "Install Aeonvera"
    : "Add to Home Screen";
  const detail = installState.standalone
    ? "Aeonvera is running like an app on this device."
    : canPrompt
    ? "Install the companion so coach messages and protocols live one tap away."
    : "On iPhone or iPad, use Share, then Add to Home Screen. On Android, use the browser install option.";

  return (
    <div className="executive-panel rounded-lg p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="micro-label">App Mode</p>
        <Bell size={17} className="royal-text" />
      </div>
      <h3 className="text-2xl font-light leading-tight text-white/86">{title}</h3>
      <p className="mt-4 text-sm leading-7 text-white/42">{detail}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {[
          ["Install", installState.standalone || canPrompt],
          ["Push", installState.push],
          ["Worker", installState.serviceWorker],
        ].map(([label, active]) => (
          <span
            key={String(label)}
            className={`rounded-md px-2.5 py-1 text-[8px] uppercase tracking-[0.14em] ${
              active
                ? "bg-white/[0.035] royal-text"
                : "bg-white/[0.02] text-white/26"
            }`}
          >
            {String(label)}
          </span>
        ))}
      </div>
      {canPrompt && !installState.standalone && (
        <button
          type="button"
          onClick={onInstall}
          className="premium-action mt-5 inline-flex h-10 w-full items-center justify-center rounded-md px-4 text-[10px] uppercase tracking-[0.14em]"
        >
          Install companion
        </button>
      )}
    </div>
  );
}

function CalendarAutomationCard({
  connected,
  message,
  migrationRequired,
  onConnect,
  onSchedule,
  scheduling,
}: {
  connected: boolean;
  message?: string | null;
  migrationRequired: boolean;
  onConnect: () => void;
  onSchedule: () => void;
  scheduling: boolean;
}) {
  return (
    <div className="executive-panel rounded-lg p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="micro-label">Calendar</p>
        <CalendarClock size={17} className="royal-text" />
      </div>
      <h3 className="text-2xl font-light leading-tight text-white/86">
        {connected ? "Google connected" : "Connect Google"}
      </h3>
      <p className="mt-4 text-sm leading-7 text-white/42">
        {connected
          ? "Schedule protocol blocks into Google Calendar so execution leaves Aeonvera and lands on the day."
          : "Connect Google Calendar to let Aeonvera schedule workouts, walks, check-ins, and protocol blocks."}
      </p>
      {message && (
        <p className="mt-4 text-xs leading-5 text-[#dabc73]/80">{message}</p>
      )}
      <button
        type="button"
        onClick={connected ? onSchedule : onConnect}
        disabled={migrationRequired || scheduling}
        className="premium-action mt-5 inline-flex h-10 w-full items-center justify-center rounded-md px-4 text-[10px] uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-45"
      >
        {migrationRequired
          ? "Migration needed"
          : connected
            ? scheduling
              ? "Scheduling"
              : "Schedule protocol"
            : "Connect calendar"}
      </button>
    </div>
  );
}

function CompanionCard({
  icon: Icon,
  label,
  title,
  detail,
  href,
}: {
  icon: typeof Bell;
  label: string;
  title: string;
  detail: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="quiet-lift executive-panel block rounded-lg p-5 transition hover:border-white/[0.14]"
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="micro-label">{label}</p>
        <Icon size={17} className="royal-text" />
      </div>
      <h3 className="text-2xl font-light leading-tight text-white/86">{title}</h3>
      <p className="mt-4 line-clamp-4 text-sm leading-7 text-white/42">{detail}</p>
    </Link>
  );
}

function totalSignals(counts: Record<string, number>) {
  return Object.values(counts).reduce((sum, value) => sum + (Number(value) || 0), 0);
}
