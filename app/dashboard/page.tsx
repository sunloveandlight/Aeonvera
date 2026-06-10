"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { isUserAllowed } from "@/lib/auth/permissions";
import PageContainer from "@/components/ui/PageContainer";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import WearablesPanel from "@/components/dashboard/WearablesPanel";
import NotificationPreferencesPanel from "@/components/dashboard/NotificationPreferencesPanel";

type Profile = {
  display_name: string | null;
  plan: string | null;
  subscription_status: string | null;
  biological_age: number | null;
};

type Report = {
  id: string;
  risk_score: number;
  primary_goal: string;
  created_at: string;
  report?: {
    top_priorities?: string[];
    strengths?: string[];
    weaknesses?: string[];
    "90_day_plan"?: Array<{
      category: string;
      action: string;
      impact: string;
    }>;
  } | null;
};

type Alert = {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  recommendation: string;
  created_at: string;
};

type HealthState = {
  baseline?: Record<string, number>;
  risk_scores?: Record<string, number>;
  insights?: string[];
  updated_at?: string;
};

type WearableMetricRow = {
  provider?: string | null;
  recorded_at?: string | null;
};

type WearableConnection = {
  provider: "oura" | "whoop";
  status: string;
  scope: string | null;
  expires_at: string | null;
  last_synced_at: string | null;
  connected_at: string | null;
};

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof HTMLElement
    ? Boolean(target.closest("button, input, label, select, textarea, a"))
    : false;
}

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [hasAssessment, setHasAssessment] = useState(false);
  const [assessmentAge, setAssessmentAge] = useState<number | null>(null);
  const [accuracyScore, setAccuracyScore] = useState<number>(40);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);
  const [healthState, setHealthState] = useState<HealthState | null>(null);
  const [wearableRows, setWearableRows] = useState<WearableMetricRow[]>([]);
  const [wearableConnections, setWearableConnections] = useState<WearableConnection[]>([]);
  const [wearableSyncing, setWearableSyncing] = useState<string | null>(null);
  const [wearableMessage, setWearableMessage] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("wearableConnected");
    const error = params.get("wearableError");

    if (connected) return `${connected.toUpperCase()} connected. Sync latest data when ready.`;
    if (error) return error;
    return null;
  });
  const [applePayload, setApplePayload] = useState("");
  const [appleImportFile, setAppleImportFile] = useState<File | null>(null);
  const [firstReportPrompt, setFirstReportPrompt] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("firstReport") === "1";
  });
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return router.replace("/login");

        const { data: profileData } = await supabase
          .from("profiles")
          .select("display_name, plan, subscription_status, biological_age")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!profileData) return router.replace("/onboarding");
        if (!isUserAllowed(profileData.plan, profileData.subscription_status)) {
          return router.replace("/pricing");
        }

        setProfile(profileData);

        const [reportRes, assessmentRes, alertsRes, stateRes, wearableRes, connectionRes] = await Promise.all([
          supabase
            .from("longevity_reports")
            .select("id, risk_score, primary_goal, created_at, report")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),

          supabase
            .from("longevity_assessments")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),

          supabase
            .from("health_alerts")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(3),

          supabase
            .from("health_states")
            .select("baseline, risk_scores, insights, updated_at")
            .eq("user_id", user.id)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle(),

          supabase
            .from("wearable_metrics")
            .select("provider, recorded_at")
            .eq("user_id", user.id)
            .order("recorded_at", { ascending: false })
            .limit(50),

          fetch("/api/wearables/connections", {
            credentials: "include",
          }).then((response) => response.json()).catch(() => null),
        ]);

        if (reportRes.data) setReport(reportRes.data);

        if (assessmentRes.data) {
          setHasAssessment(true);
          setAssessmentAge(Number(assessmentRes.data.age) || null);

          // Compute accuracy
          const optionalKeys = [
            "resting_hr", "blood_pressure_systolic", "vo2_max", "hrv",
            "fasting_glucose", "hba1c", "ldl", "hdl", "triglycerides",
            "fasting_insulin", "hscrp", "body_fat_pct", "waist_cm",
            "anxiety_level", "social_connection", "purpose_score",
            "family_longevity", "family_heart_disease", "family_diabetes",
          ];
          const filled = optionalKeys.filter(
            (k) => assessmentRes.data[k] != null && assessmentRes.data[k] !== ""
          ).length;
          setAccuracyScore(
            Math.min(100, 40 + Math.round((filled / optionalKeys.length) * 60))
          );

          // Auto-compute bio age if missing
          if (!profileData.biological_age) {
            fetch("/api/longevity/biological-age", {
              method: "POST",
              credentials: "include",
            })
              .then((r) => r.json())
              .then((d) => {
                if (d.result?.biologicalAge) {
                  setProfile((prev) =>
                    prev ? { ...prev, biological_age: d.result.biologicalAge } : prev
                  );
                }
              })
              .catch(console.error);
          }
        }

        if (alertsRes.data) setAlerts(alertsRes.data);
        if (stateRes.data) setHealthState(stateRes.data);
        if (wearableRes.data) setWearableRows(wearableRes.data);
        if (connectionRes?.connections) {
          setWearableConnections(connectionRes.connections);
        }

        setLoading(false);
      } catch (err) {
        console.error(err);
        setError("System failure. Please retry.");
        setLoading(false);
      }
    };

    run();
  }, [router]);

  async function handleGenerateReport() {
    if (!hasAssessment || generatingReport) return;

    try {
      setGeneratingReport(true);
      setGenerationMessage("Computing biological age...");

      const bioAgeRes = await fetch("/api/longevity/biological-age", {
        method: "POST",
        credentials: "include",
      });
      const bioAgeData = await bioAgeRes.json();

      if (!bioAgeRes.ok) {
        throw new Error(bioAgeData.error || "Failed to compute biological age.");
      }

      if (bioAgeData.result?.biologicalAge) {
        setProfile((prev) =>
          prev
            ? { ...prev, biological_age: bioAgeData.result.biologicalAge }
            : prev
        );
      }

      setGenerationMessage("Generating longevity report...");

      const reportRes = await fetch("/api/longevity/report", {
        method: "POST",
        credentials: "include",
      });
      const reportData = await reportRes.json();

      if (!reportRes.ok) {
        throw new Error(reportData.error || "Failed to generate report.");
      }

      if (reportData.report) {
        setReport(reportData.report);
      }

      if (reportData.alert) {
        setAlerts((prev) => [reportData.alert, ...prev].slice(0, 3));
      }

      setGenerationMessage("Report ready. Dashboard updated.");
      setFirstReportPrompt(false);
      router.replace("/dashboard");
    } catch (err) {
      console.error(err);
      setGenerationMessage(
        err instanceof Error ? err.message : "Report generation failed."
      );
    } finally {
      setGeneratingReport(false);
    }
  }

  async function handleWearableSync(provider: "oura" | "whoop" | "apple") {
    try {
      setWearableSyncing(provider);
      setWearableMessage(
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

        if (!payload && !appleImportFile) {
          throw new Error("Add Apple Health JSON, a file, or a picture before importing.");
        }

        if (appleImportFile) {
          const formData = new FormData();
          formData.append("file", appleImportFile);
          if (payload) formData.append("payload", payload);
          requestInit = { ...requestInit, body: formData };
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
        throw new Error(data.error || "Wearable sync failed.");
      }

      if (data.state) {
        setHealthState({
          baseline: data.state.baseline,
          risk_scores: data.state.riskScores,
          insights: data.state.insights,
          updated_at: data.state.updatedAt,
        });
      }

      setWearableRows((prev) => [
        ...Array.from({ length: data.inserted || 0 }, () => ({
          provider,
          recorded_at: new Date().toISOString(),
        })),
        ...prev,
      ].slice(0, 50));

      setAlerts((prev) => [
        {
          id: `${provider}-${Date.now()}`,
          type: "wearable_sync",
          severity: "low",
          title: "Wearable data synced",
          message: `${provider} data updated.`,
          recommendation: "Your dashboard has been rebuilt from the latest wearable metrics.",
          created_at: new Date().toISOString(),
        },
        ...prev,
      ].slice(0, 3));

      setWearableMessage(
        `${provider.toUpperCase()} synced ${data.inserted} metrics and updated health state.`
      );
      if (provider === "apple") {
        setApplePayload("");
        setAppleImportFile(null);
      }
    } catch (err) {
      console.error(err);
      setWearableMessage(
        err instanceof Error ? err.message : "Wearable sync failed."
      );
    } finally {
      setWearableSyncing(null);
    }
  }

  function handleWearableProviderAction(provider: "oura" | "whoop") {
    const connected = wearableConnections.some(
      (connection) =>
        connection.provider === provider && connection.status === "connected"
    );

    if (!connected) {
      window.location.assign(`/api/wearables/${provider}/connect`);
      return;
    }

    handleWearableSync(provider);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border border-white/[0.06]" />
          <div className="absolute inset-0 rounded-full border-t royal-border animate-spin" />
        </div>
        <p className="text-white/20 text-[10px] tracking-[0.14em] uppercase">Loading</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-400/70 text-sm">
        {error}
      </div>
    );
  }

  const bioAge = profile?.biological_age ?? null;
  const ageDelta = bioAge && assessmentAge ? bioAge - assessmentAge : null;
  const latestPriority =
    report?.report?.top_priorities?.[0] || report?.primary_goal || null;
  const connectedProviders = Array.from(
    new Set([
      ...wearableConnections
        .filter((connection) => connection.status === "connected")
        .map((connection) => connection.provider),
      ...wearableRows.map((row) => row.provider).filter(Boolean),
    ])
  );
  const latestWearableAt = wearableRows
    .map((row) => row.recorded_at)
    .filter(Boolean)
    .sort()
    .at(-1);
  const wearableRisk = healthState?.risk_scores || {};
  const wearableBaselines = healthState?.baseline || {};
  const connectedProviderSet = new Set(
    wearableConnections
      .filter((connection) => connection.status === "connected")
      .map((connection) => connection.provider)
  );

  const bioAgeColor = "text-white/86";

  const hour = currentTime.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const systemStatus =
    !hasAssessment ? "NOT STARTED"
    : !bioAge ? "COMPUTING"
    : ageDelta !== null && ageDelta <= 0 ? "STABLE"
    : ageDelta !== null && ageDelta <= 4 ? "NEEDS REVIEW"
    : "PRIORITY REVIEW";

  return (
    <PageContainer>
      <div className="py-16 space-y-10">

        {/* ═══════════════════════════════════════
            HEADER
        ═══════════════════════════════════════ */}
        <div className="pb-10">
          <div className="flex items-start justify-between flex-wrap gap-6">
            <div>
              <p className="micro-label mb-5">
                {currentTime.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
              <h1 className="text-5xl md:text-6xl font-light tracking-tight text-white/90 leading-tight">
                {greeting},
                <br />
                <span className="text-white/50">
                  {profile?.display_name || "User"}
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-7 text-white/40">
                Your healthspan baseline is{" "}
                {hasAssessment ? "active and up to date." : "ready when you are."}
              </p>
            </div>

            {/* SYSTEM STATUS INDICATOR */}
            <div className="flex flex-col items-end gap-2">
              <div className={`premium-status-neutral flex items-center gap-2 rounded-md px-4 py-2 ${
                systemStatus === "STABLE" ? "system-status-stable" : ""
              }`}>
                <div className={`h-1.5 w-1.5 rounded-full ${
                  systemStatus === "STABLE"
                    ? "system-status-stable-dot"
                    : "bg-white/55 shadow-[0_0_16px_rgba(255,255,255,0.18)]"
                }`} />
                <span className="text-[9px] uppercase tracking-[0.14em] text-white/78">
                  {systemStatus}
                </span>
              </div>
              <p className="text-[9px] uppercase tracking-[0.14em] text-white/25">
                {profile?.plan || "core"} · {profile?.subscription_status || "active"}
              </p>
            </div>
          </div>
          <div className="silver-rule mt-10" />
        </div>

        {/* ═══════════════════════════════════════
            HERO ROW — BIO AGE + RISK
        ═══════════════════════════════════════ */}
        <div className="grid gap-6 lg:grid-cols-[1.18fr_0.82fr]">

          {/* BIOLOGICAL AGE CARD */}
          <Card title="BIOLOGICAL AGE" glow className="min-h-[340px]">
            {bioAge ? (
              <div className="flex h-full flex-col">
                <div className="dashboard-hero-metric-block grid grid-cols-[minmax(0,1fr)_auto] items-end gap-8">
                    <div>
                      <p className="micro-label mb-2">Biological</p>
                      <div className="flex items-baseline gap-3">
                        <p className={`metric-display text-7xl md:text-8xl font-light tracking-tight leading-none ${bioAgeColor}`}>
                          {bioAge}
                        </p>
                        <span className="text-2xl font-light leading-none text-white/24">yrs</span>
                      </div>
                    </div>
                    {assessmentAge && (
                      <div className="min-w-[8rem] border-l border-white/[0.07] pl-5">
                        <p className="micro-label mb-2">Chronological</p>
                        <div className="flex items-baseline gap-2">
                          <p className="text-3xl font-light leading-none text-white/58">{assessmentAge}</p>
                          <span className="text-sm leading-none text-white/24">yrs</span>
                        </div>
                      </div>
                    )}
                </div>

                <div className="h-px overflow-hidden bg-white/[0.08]">
                  <div
                    className="living-bar"
                    style={{ width: `${Math.max(8, Math.min(100, accuracyScore))}%` }}
                  />
                </div>

                {ageDelta !== null && (
                  <p className={`mt-5 min-h-14 text-sm leading-7 ${bioAgeColor}`}>
                    {ageDelta < 0
                      ? `${Math.abs(ageDelta)} years younger than chronological age`
                      : ageDelta > 0
                      ? `${ageDelta} years older than chronological age`
                      : "Biological age matches chronological age"}
                  </p>
                )}

                <div className="mt-auto border-t border-white/[0.06] pt-5">
                  <div className="flex justify-between micro-label mb-3">
                    <span>Estimation Accuracy</span>
                    <span>{accuracyScore}%</span>
                  </div>
                  {accuracyScore < 70 && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        router.push("/assessment");
                      }}
                      className="premium-action-ghost mt-3 text-[9px] uppercase tracking-[0.14em] transition-colors duration-300"
                    >
                      Add lab data to improve →
                    </button>
                  )}
                </div>
              </div>
            ) : hasAssessment ? (
              <div className="flex items-center gap-4">
                <div className="w-6 h-6 rounded-full border-t royal-border animate-spin shrink-0" />
                <p className="text-white/25 text-sm">Computing your biological age...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-white/25 text-sm leading-relaxed">
                  Complete your assessment to compute your biological age across all domains.
                </p>
                <Button href="/assessment">Start assessment</Button>
              </div>
            )}
          </Card>

          {/* RISK + INTELLIGENCE CARD */}
          <Card
            title="INTELLIGENCE REPORT"
            className="min-h-[340px]"
            actionLabel={
              report
                ? "Open intelligence report"
                : hasAssessment
                ? "Generate intelligence report"
                : "Start assessment"
            }
            onClick={() => {
              if (report) {
                router.push("/report");
                return;
              }

              if (hasAssessment) {
                void handleGenerateReport();
                return;
              }

              router.push("/assessment");
            }}
          >
            {report ? (
              <div className="flex h-full flex-col">
                <div className="dashboard-hero-metric-block flex items-end gap-3">
                  <p className="metric-display text-6xl font-light tracking-tight leading-none text-white/86">
                    {report.risk_score}
                    <span className="text-white/15 text-2xl ml-2">/ 100</span>
                  </p>
                  <p className="text-white/35 text-sm mb-1">risk score</p>
                </div>

                <div className="h-px bg-white/[0.08] overflow-hidden mb-5">
                  <div
                    className="living-bar"
                    style={{ width: `${report.risk_score}%` }}
                  />
                </div>

                <p className="min-h-14 text-white/45 text-sm leading-7 line-clamp-2">
                  {latestPriority}
                </p>

                <div className="mt-auto flex items-center gap-3 border-t border-white/[0.06] pt-5">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      router.push("/report");
                    }}
                    className="premium-action-secondary inline-flex h-9 items-center justify-center px-4 rounded-md transition-all duration-300 text-[10px] uppercase tracking-[0.14em]"
                  >
                    Open Report
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleGenerateReport();
                    }}
                    disabled={generatingReport}
                    className="premium-action-ghost text-[10px] uppercase tracking-[0.14em] transition-colors duration-300 disabled:opacity-30"
                  >
                    {generatingReport ? "Generating..." : "Regenerate"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-white/25 text-sm leading-relaxed">
                  {hasAssessment
                    ? "Your assessment is complete. Generate your first intelligence report."
                    : "Complete your assessment to unlock AI intelligence reports."}
                </p>
                {hasAssessment ? (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleGenerateReport();
                    }}
                    disabled={generatingReport}
                    className="premium-action inline-flex h-9 items-center justify-center px-6 rounded-md transition-all duration-300 text-[10px] uppercase tracking-[0.14em] disabled:opacity-30"
                  >
                    {generatingReport ? "Generating..." : "Generate Intelligence Report"}
                  </button>
                ) : (
                  <Button href="/assessment">Start Assessment</Button>
                )}
              </div>
            )}
          </Card>

        </div>

        {(generationMessage || hasAssessment) && (
          <div
            role="button"
            tabIndex={hasAssessment && !generatingReport ? 0 : -1}
            aria-label={report ? "Refresh intelligence" : "Generate report"}
            onClick={() => {
              if (!hasAssessment || generatingReport) return;
              void handleGenerateReport();
            }}
            onKeyDown={(event) => {
              if (!hasAssessment || generatingReport || isInteractiveTarget(event.target)) return;
              if (event.key !== "Enter" && event.key !== " ") return;

              event.preventDefault();
              void handleGenerateReport();
            }}
            className={`cursor-pointer rounded-lg border p-5 transition hover:border-white/[0.16] ${
            firstReportPrompt && !report
              ? "border-white/20 royal-gradient-soft"
              : "executive-panel-soft"
          } ${!hasAssessment || generatingReport ? "cursor-not-allowed opacity-75" : ""}`}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-white/80">
                  {firstReportPrompt && !report
                    ? "Your assessment is complete"
                    : "Latest intelligence"}
                </p>
                <p className="mt-1 text-sm leading-6 text-white/50">
                  {generationMessage ||
                    (firstReportPrompt && !report
                      ? "Generate your first AI longevity report to activate the dashboard."
                      : "Generate a fresh biological age score, AI report, and dashboard alert from your latest assessment.")}
                </p>
              </div>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  void handleGenerateReport();
                }}
                disabled={!hasAssessment || generatingReport}
                className="premium-action inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-medium transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {generatingReport ? "Generating..." : report ? "Refresh intelligence" : "Generate report"}
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════
            PHASE 2 — WEARABLE DATA
        ═══════════════════════════════════════ */}
        <WearablesPanel
          wearableMessage={wearableMessage}
          connectedProvidersCount={connectedProviders.length}
          wearableRowsCount={wearableRows.length}
          latestWearableAt={latestWearableAt}
          wearableSyncing={wearableSyncing}
          connectedProviderSet={connectedProviderSet}
          applePayload={applePayload}
          appleImportFileName={appleImportFile?.name || null}
          wearableRisk={wearableRisk}
          wearableBaselines={wearableBaselines}
          firstInsight={healthState?.insights?.[0]}
          onApplePayloadChange={setApplePayload}
          onAppleImportFileChange={setAppleImportFile}
          onProviderAction={handleWearableProviderAction}
          onWearableSync={handleWearableSync}
        />

        <NotificationPreferencesPanel />

        {/* ═══════════════════════════════════════
            COACH ALERTS
        ═══════════════════════════════════════ */}
        <div>
          <p className="micro-label mb-4">
            Active Intelligence Alerts
          </p>
          {alerts.length > 0 ? (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-4 rounded-lg border border-white/[0.08] bg-white/[0.025] p-4"
                >
                  <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/35" />
                  <div className="flex-1">
                    <p className="text-white/70 text-sm font-light mb-1">{alert.title}</p>
                    <p className="text-white/40 text-xs leading-relaxed">{alert.recommendation}</p>
                  </div>
                  <span className="shrink-0 text-[9px] uppercase tracking-[0.14em] text-white/28">
                    {alert.severity}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="executive-panel-soft rounded-lg p-5">
              <p className="text-sm text-white/60">
                No active alerts yet.
              </p>
              <p className="mt-1 text-xs leading-6 text-white/40">
                Generate your first report to create an in-app coach notification.
              </p>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════
            QUICK ACTIONS
        ═══════════════════════════════════════ */}
        <div className="grid md:grid-cols-3 gap-4">
          <button
            onClick={() => router.push("/assessment")}
            className="executive-panel-soft quiet-lift rounded-lg p-5 text-left group"
          >
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/20 mb-3 group-hover:text-white/30 transition-colors">
              {hasAssessment ? "Update" : "Initialize"}
            </p>
            <p className="text-white/60 text-sm font-light">
              {hasAssessment ? "Update your assessment data" : "Start your assessment"}
            </p>
            <p className="text-[10px] uppercase tracking-[0.14em] mt-3 text-white/42 group-hover:text-white/72 transition-colors">
              {hasAssessment ? "Retake →" : "Start →"}
            </p>
          </button>

          <button
            onClick={() => router.push("/report")}
            className="executive-panel-soft quiet-lift rounded-lg p-5 text-left group"
          >
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/20 mb-3 group-hover:text-white/30 transition-colors">
              Intelligence
            </p>
            <p className="text-white/60 text-sm font-light">
              View your full biological profile and 90-day protocol
            </p>
            <p className="text-[10px] uppercase tracking-[0.14em] mt-3 text-white/42 group-hover:text-white/72 transition-colors">
              Open report →
            </p>
          </button>

          <button
            onClick={() => router.push("/pricing")}
            className="executive-panel-soft quiet-lift rounded-lg p-5 text-left group"
          >
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/20 mb-3 group-hover:text-white/30 transition-colors">
              Account
            </p>
            <p className="text-white/60 text-sm font-light">
              {profile?.plan ? `${profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1)} plan · ${profile.subscription_status}` : "Manage subscription"}
            </p>
            <p className="text-[10px] uppercase tracking-[0.14em] mt-3 text-white/42 group-hover:text-white/72 transition-colors">
              Manage →
            </p>
          </button>
        </div>

      </div>
    </PageContainer>
  );
}
