"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { isUserAllowed } from "@/lib/auth/permissions";
import PageContainer from "@/components/ui/PageContainer";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

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
  const [wearableSyncing, setWearableSyncing] = useState<string | null>(null);
  const [wearableMessage, setWearableMessage] = useState<string | null>(null);
  const [applePayload, setApplePayload] = useState("");
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

        const [reportRes, assessmentRes, alertsRes, stateRes, wearableRes] = await Promise.all([
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

      const body =
        provider === "apple"
          ? applePayload.trim()
            ? JSON.parse(applePayload)
            : null
          : {};

      if (provider === "apple" && !body) {
        throw new Error("Paste Apple Health JSON before importing.");
      }

      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
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
      if (provider === "apple") setApplePayload("");
    } catch (err) {
      console.error(err);
      setWearableMessage(
        err instanceof Error ? err.message : "Wearable sync failed."
      );
    } finally {
      setWearableSyncing(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border border-white/[0.06]" />
          <div className="absolute inset-0 rounded-full border-t royal-border animate-spin" />
        </div>
        <p className="text-white/20 text-[10px] tracking-normal uppercase">Initializing</p>
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
    new Set(wearableRows.map((row) => row.provider).filter(Boolean))
  );
  const latestWearableAt = wearableRows
    .map((row) => row.recorded_at)
    .filter(Boolean)
    .sort()
    .at(-1);
  const wearableRisk = healthState?.risk_scores || {};
  const wearableBaselines = healthState?.baseline || {};

  const bioAgeColor =
    ageDelta === null ? "text-white/70"
    : ageDelta <= -3 ? "text-green-400"
    : ageDelta <= 0 ? "text-emerald-400"
    : ageDelta <= 4 ? "text-yellow-400"
    : "text-red-400";

  const hour = currentTime.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const systemStatus =
    !hasAssessment ? "UNINITIALIZED"
    : !bioAge ? "COMPUTING"
    : ageDelta !== null && ageDelta <= 0 ? "OPTIMAL"
    : ageDelta !== null && ageDelta <= 4 ? "ATTENTION REQUIRED"
    : "INTERVENTION ADVISED";

  const statusColor =
    systemStatus === "OPTIMAL" ? "text-green-400"
    : systemStatus === "ATTENTION REQUIRED" ? "text-yellow-400"
    : systemStatus === "INTERVENTION ADVISED" ? "text-red-400"
    : "text-white/30";

  return (
    <PageContainer>
      <div className="py-14 space-y-8">

        {/* ═══════════════════════════════════════
            HEADER
        ═══════════════════════════════════════ */}
        <div className="border-b border-white/[0.04] pb-10">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-normal text-white/15 mb-4">
                {currentTime.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
              <h1 className="text-5xl md:text-6xl font-light tracking-normal text-white/90 leading-tight">
                {greeting},
                <br />
                <span className="text-white/40">
                  {profile?.display_name || "User"}
                </span>
              </h1>
              <p className="mt-4 text-white/25 text-sm leading-relaxed max-w-lg">
                Your biological operating system is{" "}
                {hasAssessment ? "active and monitoring." : "waiting for initialization."}
              </p>
            </div>

            {/* SYSTEM STATUS INDICATOR */}
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/[0.06] bg-white/[0.02]">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  systemStatus === "OPTIMAL" ? "bg-green-400"
                  : systemStatus === "ATTENTION REQUIRED" ? "bg-yellow-400"
                  : systemStatus === "INTERVENTION ADVISED" ? "bg-red-400 animate-pulse"
                  : "bg-white/20"
                }`} />
                <span className={`text-[9px] uppercase tracking-normal ${statusColor}`}>
                  {systemStatus}
                </span>
              </div>
              <p className="text-[9px] uppercase tracking-normal text-white/15">
                {profile?.plan || "core"} · {profile?.subscription_status || "active"}
              </p>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════
            HERO ROW — BIO AGE + RISK
        ═══════════════════════════════════════ */}
        <div className="grid md:grid-cols-2 gap-6">

          {/* BIOLOGICAL AGE CARD */}
          <Card title="BIOLOGICAL AGE" glow>
            {bioAge ? (
              <div>
                <div className="flex items-end gap-4 mb-3">
                  <p className={`text-5xl md:text-6xl font-light tracking-normal leading-none ${bioAgeColor}`}>
                    {bioAge}
                    <span className="text-white/15 text-2xl ml-2">yrs</span>
                  </p>
                  {assessmentAge && (
                    <div className="mb-1">
                      <p className="text-[9px] uppercase tracking-normal text-white/15 mb-0.5">Chrono</p>
                      <p className="text-white/35 text-xl font-light">{assessmentAge}</p>
                    </div>
                  )}
                </div>

                {ageDelta !== null && (
                  <p className={`text-sm mb-4 ${bioAgeColor}`}>
                    {ageDelta < 0
                      ? `${Math.abs(ageDelta)} years younger than chronological age`
                      : ageDelta > 0
                      ? `${ageDelta} years older than chronological age`
                      : "Biological age matches chronological age"}
                  </p>
                )}

                {/* ACCURACY BAR */}
                <div className="border-t border-white/[0.04] pt-4">
                  <div className="flex justify-between text-[9px] uppercase tracking-normal text-white/20 mb-2">
                    <span>Estimation Accuracy</span>
                    <span>{accuracyScore}%</span>
                  </div>
                  <div className="h-px bg-white/[0.06] overflow-hidden">
                    <div
                      className={`h-full transition-all duration-1000 ${
                        accuracyScore >= 80 ? "bg-green-400/50"
                        : accuracyScore >= 60 ? "bg-yellow-400/50"
                        : "bg-orange-400/50"
                      }`}
                      style={{ width: `${accuracyScore}%` }}
                    />
                  </div>
                  {accuracyScore < 70 && (
                    <button
                      onClick={() => router.push("/assessment")}
                      className="mt-2 text-[9px] uppercase tracking-normal royal-text hover:royal-text transition-colors duration-300"
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
                <Button href="/assessment">Initialize Assessment</Button>
              </div>
            )}
          </Card>

          {/* RISK + INTELLIGENCE CARD */}
          <Card title="INTELLIGENCE REPORT">
            {report ? (
              <div>
                <div className="flex items-end gap-3 mb-3">
                  <p className={`text-5xl md:text-6xl font-light tracking-normal leading-none ${
                    report.risk_score <= 35 ? "text-green-400"
                    : report.risk_score <= 65 ? "text-yellow-400"
                    : "text-red-400"
                  }`}>
                    {report.risk_score}
                    <span className="text-white/15 text-2xl ml-2">/ 100</span>
                  </p>
                  <p className="text-white/25 text-sm mb-1">risk score</p>
                </div>

                <div className="h-px bg-white/[0.04] overflow-hidden mb-4">
                  <div
                    className={`h-full ${
                      report.risk_score <= 35 ? "bg-green-400/40"
                      : report.risk_score <= 65 ? "bg-yellow-400/40"
                      : "bg-red-400/40"
                    }`}
                    style={{ width: `${report.risk_score}%` }}
                  />
                </div>

                <p className="text-white/30 text-sm leading-relaxed mb-6 line-clamp-2">
                  {latestPriority}
                </p>

                <div className="flex items-center gap-3 border-t border-white/[0.04] pt-4">
                  <button
                    onClick={() => router.push("/report")}
                    className="px-4 py-2 rounded-full border royal-border royal-text hover:royal-border hover:royal-text transition-all duration-300 text-[10px] uppercase tracking-normal"
                  >
                    Open Report
                  </button>
                  <button
                    onClick={handleGenerateReport}
                    disabled={generatingReport}
                    className="text-[10px] uppercase tracking-normal text-white/15 hover:text-white/40 transition-colors duration-300 disabled:opacity-30"
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
                    onClick={handleGenerateReport}
                    disabled={generatingReport}
                    className="px-6 py-2.5 rounded-full border royal-border royal-text hover:royal-border hover:royal-text transition-all duration-300 text-[10px] uppercase tracking-normal disabled:opacity-30"
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
          <div className={`rounded-lg border p-5 ${
            firstReportPrompt && !report
              ? "royal-border royal-gradient-soft"
              : "border-white/10 bg-[#151517]"
          }`}>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-white/80">
                  {firstReportPrompt && !report
                    ? "Your assessment is complete"
                    : "Phase 1 intelligence loop"}
                </p>
                <p className="mt-1 text-sm text-white/45">
                  {generationMessage ||
                    (firstReportPrompt && !report
                      ? "Generate your first AI longevity report to activate the dashboard."
                      : "Generate a fresh biological age score, AI report, and dashboard alert from your latest assessment.")}
                </p>
              </div>
              <button
                onClick={handleGenerateReport}
                disabled={!hasAssessment || generatingReport}
                className="inline-flex h-11 items-center justify-center rounded-full royal-gradient px-5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {generatingReport ? "Generating..." : report ? "Refresh intelligence" : "Generate report"}
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════
            PHASE 2 — WEARABLE DATA
        ═══════════════════════════════════════ */}
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-xl">
              <p className="text-[10px] uppercase tracking-normal text-white/20">
                Phase 2 · Wearable Intelligence
              </p>
              <h2 className="mt-2 text-2xl font-light tracking-normal text-white/80">
                Continuous health state
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/35">
                Connect a device once, then let Aeonvera rebuild sleep, recovery,
                activity, and cardiovascular state as new data arrives.
              </p>
              {wearableMessage && (
                <p className="mt-3 text-sm leading-6 royal-text">{wearableMessage}</p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 text-right">
              <div>
                <p className="text-[9px] uppercase tracking-normal text-white/18">Sources</p>
                <p className="mt-1 text-xl font-light text-white/70">
                  {connectedProviders.length || 0}
                </p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-normal text-white/18">Metrics</p>
                <p className="mt-1 text-xl font-light text-white/70">
                  {wearableRows.length}
                </p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-normal text-white/18">Updated</p>
                <p className="mt-1 text-sm font-light text-white/55">
                  {latestWearableAt
                    ? new Date(latestWearableAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    : "None"}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr_1.2fr]">
            {(["oura", "whoop"] as const).map((provider) => (
              <button
                key={provider}
                onClick={() => handleWearableSync(provider)}
                disabled={Boolean(wearableSyncing)}
                className="rounded-lg border border-white/[0.06] bg-[#151517] p-4 text-left transition hover:border-white/14 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <p className="text-[10px] uppercase tracking-normal text-white/20">
                  {provider === "oura" ? "Oura Ring" : "WHOOP"}
                </p>
                <p className="mt-2 text-sm text-white/65">
                  {wearableSyncing === provider ? "Syncing..." : "Sync latest data"}
                </p>
                <p className="mt-2 text-xs leading-5 text-white/30">
                  Pulls sleep, recovery, strain, and activity metrics into health state.
                </p>
              </button>
            ))}

            <div className="rounded-lg border border-white/[0.06] bg-[#151517] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-normal text-white/20">
                    Apple Health
                  </p>
                  <p className="mt-2 text-sm text-white/65">Import export JSON</p>
                </div>
                <button
                  onClick={() => handleWearableSync("apple")}
                  disabled={Boolean(wearableSyncing)}
                  className="rounded-full royal-gradient px-4 py-2 text-[10px] uppercase tracking-normal text-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {wearableSyncing === "apple" ? "Importing" : "Import"}
                </button>
              </div>
              <textarea
                value={applePayload}
                onChange={(event) => setApplePayload(event.target.value)}
                placeholder='{"records":[{"type":"HKQuantityTypeIdentifierStepCount","value":8400,"endDate":"2026-06-09T08:00:00Z"}]}'
                className="mt-3 h-24 w-full resize-none rounded-md border border-white/[0.06] bg-black/20 p-3 text-xs leading-5 text-white/55 outline-none transition placeholder:text-white/16 focus:border-white/16"
              />
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            {[
              ["Sleep", wearableRisk.sleep, wearableBaselines.sleep_hours ? `${wearableBaselines.sleep_hours}h` : "—"],
              ["Recovery", wearableRisk.recovery, wearableBaselines.recovery_score ?? "—"],
              ["Activity", wearableRisk.activity, wearableBaselines.daily_steps ? `${wearableBaselines.daily_steps}` : "—"],
              ["Metabolic", wearableRisk.metabolic, wearableBaselines.blood_glucose ?? "—"],
            ].map(([label, risk, baseline]) => (
              <div
                key={label}
                className="rounded-lg border border-white/[0.05] bg-white/[0.018] p-4"
              >
                <p className="text-[9px] uppercase tracking-normal text-white/18">
                  {label}
                </p>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <p className="text-xl font-light text-white/70">
                    {typeof risk === "number" ? risk : "—"}
                  </p>
                  <p className="text-xs text-white/25">{baseline}</p>
                </div>
                <div className="mt-3 h-px bg-white/[0.06]">
                  <div
                    className="h-full royal-gradient"
                    style={{ width: `${typeof risk === "number" ? risk : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {healthState?.insights?.[0] && (
            <p className="mt-4 text-xs leading-6 text-white/34">
              {healthState.insights[0]}
            </p>
          )}
        </div>

        {/* ═══════════════════════════════════════
            COACH ALERTS
        ═══════════════════════════════════════ */}
        <div>
          <p className="text-[10px] uppercase tracking-normal text-white/15 mb-4">
            Active Intelligence Alerts
          </p>
          {alerts.length > 0 ? (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-start gap-4 p-4 rounded-xl border ${
                    alert.severity === "high"
                      ? "border-red-500/15 bg-red-500/[0.04]"
                      : alert.severity === "medium"
                      ? "border-yellow-500/15 bg-yellow-500/[0.04]"
                      : "border-white/[0.05] bg-white/[0.02]"
                  }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                    alert.severity === "high" ? "bg-red-400"
                    : alert.severity === "medium" ? "bg-yellow-400"
                    : "bg-white/30"
                  }`} />
                  <div className="flex-1">
                    <p className="text-white/60 text-sm font-light mb-1">{alert.title}</p>
                    <p className="text-white/30 text-xs leading-relaxed">{alert.recommendation}</p>
                  </div>
                  <span className={`text-[9px] uppercase tracking-normal shrink-0 ${
                    alert.severity === "high" ? "text-red-400/60"
                    : alert.severity === "medium" ? "text-yellow-400/60"
                    : "text-white/20"
                  }`}>
                    {alert.severity}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-5">
              <p className="text-sm text-white/55">
                No active alerts yet.
              </p>
              <p className="mt-1 text-xs leading-6 text-white/32">
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
            className="premium-surface rounded-lg p-5 text-left transition-all duration-300 hover:border-white/15 group"
          >
            <p className="text-[10px] uppercase tracking-normal text-white/20 mb-3 group-hover:text-white/30 transition-colors">
              {hasAssessment ? "Update" : "Initialize"}
            </p>
            <p className="text-white/60 text-sm font-light">
              {hasAssessment ? "Update your assessment data" : "Start your assessment"}
            </p>
            <p className="royal-text text-[10px] uppercase tracking-normal mt-3">
              {hasAssessment ? "Retake →" : "Start →"}
            </p>
          </button>

          <button
            onClick={() => router.push("/report")}
            className="premium-surface rounded-lg p-5 text-left transition-all duration-300 hover:border-white/15 group"
          >
            <p className="text-[10px] uppercase tracking-normal text-white/20 mb-3 group-hover:text-white/30 transition-colors">
              Intelligence
            </p>
            <p className="text-white/60 text-sm font-light">
              View your full biological profile and 90-day protocol
            </p>
            <p className="royal-text text-[10px] uppercase tracking-normal mt-3">
              Open report →
            </p>
          </button>

          <button
            onClick={() => router.push("/pricing")}
            className="premium-surface rounded-lg p-5 text-left transition-all duration-300 hover:border-white/15 group"
          >
            <p className="text-[10px] uppercase tracking-normal text-white/20 mb-3 group-hover:text-white/30 transition-colors">
              Account
            </p>
            <p className="text-white/60 text-sm font-light">
              {profile?.plan ? `${profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1)} plan · ${profile.subscription_status}` : "Manage subscription"}
            </p>
            <p className="royal-text text-[10px] uppercase tracking-normal mt-3">
              Manage →
            </p>
          </button>
        </div>

      </div>
    </PageContainer>
  );
}
