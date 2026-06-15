"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Bell,
  CalendarClock,
  Database,
  FileUp,
  HeartPulse,
  LockKeyhole,
  RefreshCcw,
  Upload,
} from "lucide-react";
import PageContainer from "@/components/ui/PageContainer";
import AccessState, { EmptyState } from "@/components/ui/AccessState";
import {
  buildDataSourceIntelligence,
  formatFreshness,
  type DataSourceIntelligence,
} from "@/lib/data/dataSourceIntelligence";
import { supabase } from "@/lib/supabase/client";

type WearableProvider = "oura" | "whoop" | "apple";

type WearableConnection = {
  provider: "oura" | "whoop";
  status: string;
  scope: string | null;
  expires_at: string | null;
  last_synced_at: string | null;
  connected_at: string | null;
};

type WearableMetricRow = {
  provider?: string | null;
  metric_name?: string | null;
  recorded_at?: string | null;
};

type LabBiomarkerRow = {
  canonical_key: string;
  value: number | string;
  unit?: string | null;
  measured_at: string;
};

type CalendarStatus = {
  connected?: boolean;
  connection?: {
    provider?: string | null;
    status?: string | null;
    connected_at?: string | null;
    updated_at?: string | null;
  } | null;
  migrationRequired?: boolean;
  message?: string;
};

type HealthState = {
  baseline?: Record<string, number>;
  insights?: string[];
  updated_at?: string;
};

type SourceStatus = "connected" | "ready" | "missing" | "locked" | "pending";

export default function DataSourcesPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [connections, setConnections] = useState<WearableConnection[]>([]);
  const [connectionsLocked, setConnectionsLocked] = useState(false);
  const [wearableRows, setWearableRows] = useState<WearableMetricRow[]>([]);
  const [labRows, setLabRows] = useState<LabBiomarkerRow[]>([]);
  const [healthState, setHealthState] = useState<HealthState | null>(null);
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null);
  const [applePayload, setApplePayload] = useState("");
  const [appleFile, setAppleFile] = useState<File | null>(null);
  const [labPayload, setLabPayload] = useState("");
  const [labFile, setLabFile] = useState<File | null>(null);
  const [syncing, setSyncing] = useState<WearableProvider | null>(null);
  const [labImporting, setLabImporting] = useState(false);
  const [sourceCheckSending, setSourceCheckSending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSources() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) {
          setAuthenticated(false);
          setLoading(false);
        }
        return;
      }

      try {
        const [
          connectionRes,
          wearableRes,
          labRes,
          stateRes,
          calendarRes,
        ] = await Promise.all([
          fetch("/api/wearables/connections", { credentials: "include" })
            .then((response) => response.json())
            .catch(() => null),
          supabase
            .from("wearable_metrics")
            .select("provider, metric_name, recorded_at")
            .eq("user_id", user.id)
            .order("recorded_at", { ascending: false })
            .limit(80),
          supabase
            .from("lab_biomarkers")
            .select("canonical_key, value, unit, measured_at")
            .eq("user_id", user.id)
            .order("measured_at", { ascending: false })
            .limit(24),
          supabase
            .from("health_states")
            .select("baseline, insights, updated_at")
            .eq("user_id", user.id)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          fetch("/api/calendar/google/status", { credentials: "include" })
            .then((response) => response.json())
            .catch(() => null),
        ]);

        if (cancelled) return;

        setAuthenticated(true);
        setConnections(connectionRes?.connections || []);
        setConnectionsLocked(Boolean(connectionRes?.locked));
        setWearableRows((wearableRes.data || []) as WearableMetricRow[]);
        setLabRows((labRes.data || []) as LabBiomarkerRow[]);
        setHealthState((stateRes.data || null) as HealthState | null);
        setCalendarStatus(calendarRes);
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Could not load data sources.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadSources();

    return () => {
      cancelled = true;
    };
  }, []);

  const connectedProviders = useMemo(
    () =>
      new Set(
        connections
          .filter((connection) => connection.status === "connected")
          .map((connection) => connection.provider)
      ),
    [connections]
  );
  const appleRows = wearableRows.filter((row) => row.provider === "apple");
  const latestWearableAt = latestDate(wearableRows.map((row) => row.recorded_at));
  const latestLabAt = latestDate(labRows.map((row) => row.measured_at));
  const sourceIntelligence = buildDataSourceIntelligence({
    appleRows,
    calendarConnected: Boolean(calendarStatus?.connected),
    connectedProviders,
    healthState,
    labRows,
    wearableRows,
  });

  async function refreshSources() {
    setLoading(true);
    setMessage(null);
    window.location.reload();
  }

  async function handleProviderAction(provider: "oura" | "whoop") {
    const connected = connectedProviders.has(provider);

    if (!connected) {
      if (provider === "whoop") {
        setMessage("Direct WHOOP sync is coming soon.");
        return;
      }

      window.location.assign(`/api/wearables/${provider}/connect`);
      return;
    }

    await syncWearable(provider);
  }

  async function syncWearable(provider: WearableProvider) {
    try {
      setSyncing(provider);
      setMessage(
        provider === "apple" ? "Importing Apple Health..." : `Syncing ${provider.toUpperCase()}...`
      );

      const endpoint =
        provider === "oura"
          ? "/api/wearables/oura/sync"
          : provider === "whoop"
          ? "/api/wearables/whoop/sync"
          : "/api/wearables/apple/import";
      let requestInit: RequestInit = {
        method: "POST",
        credentials: "include",
      };

      if (provider === "apple") {
        const payload = applePayload.trim();
        if (!payload && !appleFile) {
          throw new Error("Add an Apple Health export, text, CSV, JSON, or screenshot first.");
        }

        if (appleFile) {
          const form = new FormData();
          form.append("file", appleFile);
          if (payload) form.append("payload", payload);
          requestInit = { ...requestInit, body: form };
        } else {
          requestInit = {
            ...requestInit,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(JSON.parse(payload)),
          };
        }
      } else {
        requestInit = {
          ...requestInit,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        };
      }

      const response = await fetch(endpoint, requestInit);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Data source sync failed.");
      }

      setWearableRows((current) => [
        ...Array.from({ length: data.inserted || 0 }, () => ({
          provider,
          metric_name: "synced_metric",
          recorded_at: new Date().toISOString(),
        })),
        ...current,
      ].slice(0, 80));
      setMessage(`${provider.toUpperCase()} added ${data.inserted || 0} metrics and refreshed health state.`);

      if (provider === "apple") {
        setApplePayload("");
        setAppleFile(null);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Data source sync failed.");
    } finally {
      setSyncing(null);
    }
  }

  async function importLabs() {
    if (!labPayload.trim() && !labFile) {
      setMessage("Add lab values, a PDF, CSV, text file, or lab screenshot before importing.");
      return;
    }

    try {
      setLabImporting(true);
      setMessage("Importing clinical biomarkers...");

      const form = new FormData();
      if (labPayload.trim()) form.append("payload", labPayload.trim());
      if (labFile) form.append("file", labFile);

      const response = await fetch("/api/labs/import", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Lab import failed.");
      }

      setLabRows((current) => [...(data.inserted || []), ...current].slice(0, 24));
      setLabPayload("");
      setLabFile(null);
      setMessage(`Imported ${data.inserted?.length || 0} biomarkers and refreshed biological age.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Lab import failed.");
    } finally {
      setLabImporting(false);
    }
  }

  async function sendSourceCheck() {
    try {
      setSourceCheckSending(true);
      setMessage("Sending source intelligence check...");

      const response = await fetch("/api/notifications/test-data-source", {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Source check failed.");
      }

      setMessage(
        data.status === "sent"
          ? "Source intelligence check sent."
          : data.message || "Source intelligence check completed."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Source check failed.");
    } finally {
      setSourceCheckSending(false);
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <main className="py-14">
          <AccessState
            eyebrow="Data Sources"
            title="Reading your connected health layer."
            body="Aeonvera is checking wearable, lab, calendar, notification, and health-state freshness."
            actions={[{ href: "/dashboard", label: "Dashboard", variant: "secondary" }]}
          />
        </main>
      </PageContainer>
    );
  }

  if (authenticated === false) {
    return (
      <PageContainer>
        <main className="py-14">
          <AccessState
            eyebrow="Data Sources"
            title="Sign in to connect your health data."
            body="Wearables, labs, Apple Health, calendars, and notification settings belong inside your private Aeonvera account."
            actions={[
              { href: "/login?mode=signin", label: "Sign in" },
              { href: "/pricing", label: "Compare tiers", variant: "secondary" },
            ]}
          />
        </main>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <main className="py-14 md:py-16">
        <section className="executive-panel rounded-lg p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="micro-label">Data Sources</p>
              <h1 className="mt-5 max-w-4xl text-4xl font-light leading-tight text-white md:text-6xl">
                Your health intelligence starts with clean signal.
              </h1>
              <p className="mt-5 max-w-3xl text-sm leading-7 text-white/52">
                Connect devices, import Apple Health, upload labs, and see exactly what
                Aeonvera is using to rebuild your health state.
              </p>
              {message ? (
                <p className="mt-4 text-sm leading-6 text-[rgba(var(--gold),0.82)]">{message}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void refreshSources()}
                className="premium-action-secondary inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium"
              >
                <RefreshCcw size={15} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => void sendSourceCheck()}
                disabled={sourceCheckSending}
                className="premium-action-secondary inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-45"
              >
                {sourceCheckSending ? "Sending" : "Send Source Check"}
              </button>
              <Link
                href="/dashboard"
                className="premium-action inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium"
              >
                Dashboard
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          <SignalMetric label="Readiness" value={`${sourceIntelligence.score}%`} detail={sourceIntelligence.status} />
          <SignalMetric label="Wearable Metrics" value={wearableRows.length.toString()} detail={formatFreshness(latestWearableAt)} />
          <SignalMetric label="Lab Markers" value={labRows.length.toString()} detail={formatFreshness(latestLabAt)} />
          <SignalMetric label="Health State" value={healthState?.updated_at ? "Live" : "Building"} detail={formatFreshness(healthState?.updated_at)} />
        </section>

        <SourceIntelligencePanel intelligence={sourceIntelligence} />

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          <SourceCard
            actionLabel={connectedProviders.has("oura") ? "Sync Oura" : "Connect Oura"}
            detail={
              connectedProviders.has("oura")
                ? connectionDetail(connections.find((item) => item.provider === "oura"))
                : connectionsLocked
                ? "Oura sync unlocks on Elite and Sovereign."
                : "Secure OAuth is configured. Connect once, then sync recovery and sleep metrics."
            }
            icon={<HeartPulse size={18} />}
            status={connectionsLocked ? "locked" : connectedProviders.has("oura") ? "connected" : "ready"}
            title="Oura Ring"
            onAction={() => void handleProviderAction("oura")}
            disabled={connectionsLocked || Boolean(syncing)}
          />

          <SourceCard
            actionLabel={connectedProviders.has("whoop") ? "Sync WHOOP" : "Coming soon"}
            detail={
              connectedProviders.has("whoop")
                ? connectionDetail(connections.find((item) => item.provider === "whoop"))
                : "Direct WHOOP sync is coming soon."
            }
            icon={<Activity size={18} />}
            status={connectedProviders.has("whoop") ? "connected" : "pending"}
            title="WHOOP"
            onAction={() => void handleProviderAction("whoop")}
            disabled={Boolean(syncing)}
          />
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <ImportPanel
            accepted="JSON, CSV, text, or screenshot"
            body="Upload Apple Health exports or screenshots for sleep, HRV, resting heart rate, VO2 max, steps, and recovery signals."
            fileName={appleFile?.name || null}
            icon={<Upload size={18} />}
            label="Apple Health"
            payload={applePayload}
            placeholder="Paste your exported health data here"
            submitting={syncing === "apple"}
            submitLabel={syncing === "apple" ? "Importing" : "Import Apple Health"}
            onFileChange={setAppleFile}
            onPayloadChange={setApplePayload}
            onSubmit={() => void syncWearable("apple")}
          />

          <ImportPanel
            accepted="PDF, CSV, text, image, or manual values"
            body="Upload a lab report or enter biomarker values to deepen biological age, clinical memory, and protocol logic."
            fileName={labFile?.name || null}
            icon={<FileUp size={18} />}
            label="Clinical Labs"
            payload={labPayload}
            placeholder="Paste your exported lab results here"
            submitting={labImporting}
            submitLabel={labImporting ? "Importing" : "Import Labs"}
            onFileChange={setLabFile}
            onPayloadChange={setLabPayload}
            onSubmit={() => void importLabs()}
          />
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-3">
          <SourceCard
            actionLabel={calendarStatus?.connected ? "Connected" : "Connect calendar"}
            detail={
              calendarStatus?.connected
                ? `Calendar execution is active. ${formatFreshness(calendarStatus.connection?.updated_at || calendarStatus.connection?.connected_at)}`
                : "Connect Google Calendar or use native mobile calendar so protocols become real scheduled actions."
            }
            icon={<CalendarClock size={18} />}
            status={calendarStatus?.connected ? "connected" : "missing"}
            title="Calendar Execution"
            onAction={() => {
              if (!calendarStatus?.connected) window.location.assign("/api/calendar/google/connect");
            }}
          />
          <SourceCard
            actionLabel="Manage"
            detail="Email, push, quiet hours, and coach delivery preferences determine how Aeonvera reaches you."
            icon={<Bell size={18} />}
            status="ready"
            title="Notifications"
            href="/companion"
          />
          <SourceCard
            actionLabel="Open Twin"
            detail={healthState?.insights?.[0] || "Your Digital Twin gets stronger as labs, wearables, outcomes, and protocols accumulate."}
            icon={<Database size={18} />}
            status={healthState?.updated_at ? "connected" : "missing"}
            title="Unified Health State"
            href="/digital-twin"
          />
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-2">
          <RecentSignals
            emptyBody="Import Apple Health or sync Oura to begin filling wearable signal history."
            rows={wearableRows.slice(0, 8).map((row) => ({
              label: `${row.provider || "wearable"} ${formatKey(row.metric_name || "metric")}`,
              value: formatFreshness(row.recorded_at),
            }))}
            title="Recent Wearable Signals"
          />
          <RecentSignals
            emptyBody="Upload a lab report to activate the clinical biomarker layer."
            rows={labRows.slice(0, 8).map((row) => ({
              label: formatKey(row.canonical_key),
              value: `${row.value}${row.unit ? ` ${row.unit}` : ""} · ${formatFreshness(row.measured_at)}`,
            }))}
            title="Recent Lab Signals"
          />
        </section>
      </main>
    </PageContainer>
  );
}

function SignalMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="executive-panel flex min-h-[10rem] flex-col rounded-lg p-5">
      <p className="micro-label">{label}</p>
      <div className="mt-auto pt-5">
        <p className="tabular-nums text-3xl font-light leading-none text-white">{value}</p>
        <p className="mt-3 min-h-10 text-xs leading-5 text-white/42">{detail}</p>
      </div>
    </div>
  );
}

function SourceIntelligencePanel({
  intelligence,
}: {
  intelligence: DataSourceIntelligence;
}) {
  return (
    <section className="mt-6 executive-panel-soft rounded-lg border border-white/[0.08] p-5 md:p-6">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div>
          <p className="micro-label">Source Intelligence</p>
          <h2 className="mt-3 text-2xl font-light leading-tight text-white">
            {intelligence.headline}
          </h2>
          <p className="mt-4 text-sm leading-7 text-white/48">
            {intelligence.nextBestAction}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {intelligence.prompts.length ? (
            intelligence.prompts.map((prompt) => (
              <Link
                key={prompt.title}
                href={prompt.href}
                className="quiet-lift rounded-lg border border-white/[0.06] bg-white/[0.025] p-4 transition hover:border-white/[0.14]"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm text-white/70">{prompt.title}</p>
                  <span className={promptPriorityClassName(prompt.priority)}>
                    {prompt.priority}
                  </span>
                </div>
                <p className="line-clamp-3 text-xs leading-5 text-white/38">
                  {prompt.body}
                </p>
                <p className="mt-4 text-[9px] uppercase tracking-[0.14em] text-[rgba(var(--gold),0.72)]">
                  {prompt.actionLabel}
                </p>
              </Link>
            ))
          ) : (
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-4 sm:col-span-2">
              <p className="text-sm text-white/70">Signal is current</p>
              <p className="mt-2 text-xs leading-5 text-white/38">
                Aeonvera has enough current source depth to support advanced protocol decisions.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function SourceCard({
  actionLabel,
  detail,
  disabled = false,
  href,
  icon,
  onAction,
  status,
  title,
}: {
  actionLabel: string;
  detail: string;
  disabled?: boolean;
  href?: string;
  icon: ReactNode;
  onAction?: () => void;
  status: SourceStatus;
  title: string;
}) {
  const content = (
    <div className="quiet-lift executive-panel flex h-full flex-col rounded-lg p-5 transition hover:border-white/[0.14]">
      <div className="flex items-start justify-between gap-4">
        <div className="inline-flex size-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.035] text-[rgba(var(--gold),0.85)]">
          {icon}
        </div>
        <span className={statusClassName(status)}>{statusLabel(status)}</span>
      </div>
      <h2 className="mt-5 text-2xl font-light text-white">{title}</h2>
      <p className="mt-3 flex-1 text-sm leading-7 text-white/48">{detail}</p>
      {href ? (
        <span className="mt-5 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-[rgba(var(--gold),0.78)]">
          {actionLabel}
          <ArrowRight size={13} />
        </span>
      ) : (
        <button
          type="button"
          onClick={onAction}
          disabled={disabled}
          className="premium-action mt-5 inline-flex h-10 items-center justify-center rounded-md px-4 text-[10px] uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {disabled && status === "locked" ? (
            <LockKeyhole className="mr-2" size={13} />
          ) : null}
          {actionLabel}
        </button>
      )}
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function ImportPanel({
  accepted,
  body,
  fileName,
  icon,
  label,
  payload,
  placeholder,
  submitting,
  submitLabel,
  onFileChange,
  onPayloadChange,
  onSubmit,
}: {
  accepted: string;
  body: string;
  fileName: string | null;
  icon: ReactNode;
  label: string;
  payload: string;
  placeholder: string;
  submitting: boolean;
  submitLabel: string;
  onFileChange: (file: File | null) => void;
  onPayloadChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="executive-panel rounded-lg p-5 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="micro-label">{label}</p>
          <h2 className="mt-3 text-2xl font-light text-white">Upload or paste data.</h2>
        </div>
        <div className="inline-flex size-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.035] text-[rgba(var(--gold),0.85)]">
          {icon}
        </div>
      </div>
      <p className="mt-4 text-sm leading-7 text-white/48">{body}</p>
      <p className="mt-2 text-[9px] uppercase tracking-[0.14em] text-white/28">{accepted}</p>
      <textarea
        value={payload}
        onChange={(event) => onPayloadChange(event.target.value)}
        placeholder={placeholder}
        className="executive-input mt-5 h-32 w-full resize-none rounded-lg p-4 text-xs leading-5 placeholder:text-white/16"
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-white/[0.025] px-4 py-3 text-xs text-white/50 transition hover:border-white/[0.16] hover:text-white/70">
          <span className="min-w-0 truncate">{fileName || "Choose file or picture"}</span>
          <span className="shrink-0 text-[9px] uppercase tracking-[0.14em] text-white/30">
            Choose
          </span>
          <input
            type="file"
            accept="application/json,application/pdf,text/plain,text/csv,.json,.pdf,.csv,.txt,image/png,image/jpeg,image/webp,image/heic,image/heif"
            className="sr-only"
            onChange={(event) => onFileChange(event.target.files?.[0] || null)}
          />
        </label>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="premium-action inline-flex h-12 items-center justify-center rounded-md px-5 text-[10px] uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {submitLabel}
        </button>
      </div>
      {fileName ? (
        <button
          type="button"
          onClick={() => onFileChange(null)}
          className="mt-3 text-left text-[9px] uppercase tracking-[0.14em] text-white/28 transition hover:text-white/55"
        >
          Remove upload
        </button>
      ) : null}
    </div>
  );
}

function RecentSignals({
  emptyBody,
  rows,
  title,
}: {
  emptyBody: string;
  rows: Array<{ label: string; value: string }>;
  title: string;
}) {
  if (!rows.length) {
    return <EmptyState body={emptyBody} title={title} />;
  }

  return (
    <div className="executive-panel rounded-lg p-5 md:p-6">
      <p className="micro-label">{title}</p>
      <div className="mt-5 space-y-3">
        {rows.map((row) => (
          <div
            key={`${row.label}-${row.value}`}
            className="flex items-center justify-between gap-4 rounded-lg border border-white/[0.06] bg-white/[0.025] p-3"
          >
            <p className="text-sm text-white/68">{row.label}</p>
            <p className="text-xs text-white/38">{row.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function connectionDetail(connection?: WearableConnection) {
  if (!connection) return "Connected.";
  return `Connected ${formatFreshness(connection.connected_at)}. Last sync: ${formatFreshness(connection.last_synced_at)}.`;
}

function latestDate(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(String(b)).getTime() - new Date(String(a)).getTime())[0] || null;
}

function formatKey(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function promptPriorityClassName(priority: "high" | "medium" | "low") {
  const base = "rounded-md px-2 py-1 text-[8px] uppercase tracking-[0.14em]";
  if (priority === "high") return `${base} text-rose-100/62 bg-rose-400/[0.08]`;
  if (priority === "medium") return `${base} royal-text bg-white/[0.035]`;
  return `${base} text-white/34 bg-white/[0.025]`;
}

function statusLabel(status: SourceStatus) {
  if (status === "connected") return "Connected";
  if (status === "ready") return "Ready";
  if (status === "locked") return "Locked";
  if (status === "pending") return "Pending";
  return "Missing";
}

function statusClassName(status: SourceStatus) {
  const base = "rounded-full border px-3 py-1 text-[8px] uppercase tracking-[0.13em]";
  if (status === "connected") return `${base} border-[rgba(var(--gold),0.24)] bg-[rgba(var(--gold),0.1)] text-[rgba(var(--gold),0.88)]`;
  if (status === "ready") return `${base} border-white/[0.1] bg-white/[0.04] text-white/55`;
  if (status === "locked") return `${base} border-white/[0.08] bg-white/[0.025] text-white/34`;
  if (status === "pending") return `${base} border-white/[0.08] bg-black/20 text-white/32`;
  return `${base} border-rose-300/12 bg-rose-300/[0.04] text-rose-100/45`;
}
