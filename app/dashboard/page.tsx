"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { isUserAllowed } from "@/lib/auth/permissions";
import PageContainer from "@/components/ui/PageContainer";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import WearablesPanel from "@/components/dashboard/WearablesPanel";
import NotificationPreferencesPanel from "@/components/dashboard/NotificationPreferencesPanel";
import TodayBriefing, {
  type TodayPrimaryAction,
} from "@/components/dashboard/TodayBriefing";
import {
  buildDataSourceIntelligence,
  type DataSourceIntelligence,
} from "@/lib/data/dataSourceIntelligence";
import {
  applyHealthSubjectFilter,
  resolveActiveHealthProfileContext,
} from "@/lib/health-profiles/activeHealthProfile";
import { resolveDisplayName } from "@/lib/profile/displayName";
import { sentenceDisplay } from "@/lib/text/display";

type Profile = {
  display_name: string | null;
  plan: string | null;
  subscription_status: string | null;
  biological_age: number | null;
};

type MembershipPlan = "core" | "elite" | "sovereign";

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

type CoachNotification = {
  id: string;
  channel: "in_app" | "email" | "push";
  status: "pending" | "sent" | "skipped" | "failed";
  title: string;
  message: string;
  payload?: Record<string, unknown> | null;
  error?: string | null;
  created_at: string;
  sent_at?: string | null;
};

type OptimizationProtocol = {
  summary?: string;
  focus_domains?: string[];
  primary_protocol?: Array<{
    domain?: string;
    action?: string;
    why?: string;
    cadence?: string;
    impact?: "low" | "medium" | "high";
  }>;
  weekly_sequence?: Array<{
    week?: string;
    focus?: string;
    actions?: string[];
  }>;
  tracking_metrics?: Array<{
    metric?: string;
    target?: string;
    source?: string;
  }>;
  coach_message?: string;
};

type OptimizationProtocolRow = {
  id: string;
  protocol: OptimizationProtocol;
  summary: string | null;
  focus_domains: string[] | null;
  status: "generated" | "fallback" | "failed";
  created_at: string;
};

type HealthState = {
  baseline?: Record<string, number>;
  risk_scores?: Record<string, number>;
  insights?: string[];
  updated_at?: string;
};

type CalendarStatus = {
  connected?: boolean;
};

type BioAgeHistoryPoint = {
  id: string;
  chronological_age: number | string;
  biological_age: number | string;
  age_delta: number | string;
  score?: number | string | null;
  accuracy_score?: number | string | null;
  category?: string | null;
  source?: string | null;
  created_at: string;
};

type BioAgeSimulation = {
  id: string;
  title: string;
  domain: string;
  action: string;
  horizon: string;
  projectedAgeDeltaImprovement: number;
  projectedBiologicalAgeImprovement: number;
  projectedBiologicalAge: number;
  projectedScore: number;
  confidence: number;
  keyDrivers: string[];
};

type LabBiomarkerRow = {
  id: string;
  canonical_key: string;
  value: number | string;
  unit?: string | null;
  measured_at: string;
};

type LabTrend = {
  canonicalKey: string;
  label: string;
  latestValue: number;
  previousValue: number | null;
  unit: string | null;
  measuredAt: string;
  delta: number | null;
  percentChange: number | null;
  status: "improving" | "worsening" | "stable" | "baseline";
  interpretation: string;
  target: string;
};

type ImprovementLoop = {
  status: "improving" | "declining" | "stable" | "building";
  phase4Complete: boolean;
  phase5Ready: boolean;
  latestBiologicalAge: number | null;
  baselineBiologicalAge: number | null;
  biologicalAgeChange: number | null;
  latestAgeDelta: number | null;
  ageDeltaChange: number | null;
  scoreChange: number | null;
  daysTracked: number;
  pacePer30Days: number | null;
  projected90DayChange: number | null;
  headline: string;
  summary: string;
  drivers: Array<{
    label: string;
    value: string;
    status: "positive" | "negative" | "neutral";
    detail: string;
  }>;
  nextActions: Array<{
    domain: string;
    action: string;
    reason: string;
    impact: "low" | "medium" | "high";
  }>;
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

function formatMembershipPlan(plan?: string | null) {
  if (!plan) return "Core intelligence";
  return `${plan.charAt(0).toUpperCase()}${plan.slice(1)} intelligence`;
}

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [coachNotifications, setCoachNotifications] = useState<CoachNotification[]>([]);
  const [optimizationProtocol, setOptimizationProtocol] =
    useState<OptimizationProtocolRow | null>(null);
  const [hasAssessment, setHasAssessment] = useState(false);
  const [assessmentAge, setAssessmentAge] = useState<number | null>(null);
  const [accuracyScore, setAccuracyScore] = useState<number>(40);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);
  const [healthState, setHealthState] = useState<HealthState | null>(null);
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null);
  const [bioAgeHistory, setBioAgeHistory] = useState<BioAgeHistoryPoint[]>([]);
  const [bioAgeSimulations, setBioAgeSimulations] = useState<BioAgeSimulation[]>([]);
  const [improvementLoop, setImprovementLoop] = useState<ImprovementLoop | null>(null);
  const [labRows, setLabRows] = useState<LabBiomarkerRow[]>([]);
  const [labTrends, setLabTrends] = useState<LabTrend[]>([]);
  const [labPayload, setLabPayload] = useState("");
  const [labImportFile, setLabImportFile] = useState<File | null>(null);
  const [labImporting, setLabImporting] = useState(false);
  const [labMessage, setLabMessage] = useState<string | null>(null);
  const [wearableRows, setWearableRows] = useState<WearableMetricRow[]>([]);
  const [wearableConnections, setWearableConnections] = useState<WearableConnection[]>([]);
  const [wearableSyncing, setWearableSyncing] = useState<string | null>(null);
  const [activatedPlan] = useState<MembershipPlan | null>(() => {
    if (typeof window === "undefined") return null;
    const plan = new URLSearchParams(window.location.search).get("activated");
    return plan === "core" || plan === "elite" || plan === "sovereign"
      ? plan
      : null;
  });
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
  const [showAdvancedConsole, setShowAdvancedConsole] = useState(false);

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
        const healthProfileContext = await resolveActiveHealthProfileContext({
          supabase,
          loginUserId: user.id,
        });

        const [
          reportRes,
          assessmentRes,
          alertsRes,
          stateRes,
          wearableRes,
          connectionRes,
          notificationRes,
          optimizationRes,
          bioAgeHistoryRes,
          bioAgeSimulatorRes,
          improvementLoopRes,
          labsRes,
          labTrendsRes,
          calendarRes,
        ] = await Promise.all([
          applyHealthSubjectFilter(
            supabase
              .from("longevity_reports")
              .select("id, risk_score, primary_goal, created_at, report"),
            healthProfileContext
          )
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),

          applyHealthSubjectFilter(
            supabase
              .from("longevity_assessments")
              .select("*"),
            healthProfileContext
          )
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),

          applyHealthSubjectFilter(
            supabase
              .from("health_alerts")
              .select("*"),
            healthProfileContext
          )
            .order("created_at", { ascending: false })
            .limit(3),

          applyHealthSubjectFilter(
            supabase
              .from("health_states")
              .select("baseline, risk_scores, insights, updated_at"),
            healthProfileContext
          )
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle(),

          applyHealthSubjectFilter(
            supabase
              .from("wearable_metrics")
              .select("provider, recorded_at"),
            healthProfileContext
          )
            .order("recorded_at", { ascending: false })
            .limit(50),

          fetch("/api/wearables/connections", {
            credentials: "include",
          }).then((response) => response.json()).catch(() => null),

          fetch("/api/notifications/deliveries", {
            credentials: "include",
          }).then((response) => response.json()).catch(() => null),

          applyHealthSubjectFilter(
            supabase
              .from("optimization_protocols")
              .select("id, protocol, summary, focus_domains, status, created_at"),
            healthProfileContext
          )
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),

          fetch("/api/longevity/biological-age", {
            credentials: "include",
          }).then((response) => response.json()).catch(() => null),

          fetch("/api/longevity/simulator", {
            credentials: "include",
          }).then((response) => response.json()).catch(() => null),

          fetch("/api/longevity/improvement-loop", {
            credentials: "include",
          }).then((response) => response.json()).catch(() => null),

          applyHealthSubjectFilter(
            supabase
              .from("lab_biomarkers")
              .select("id, canonical_key, value, unit, measured_at"),
            healthProfileContext
          )
            .order("measured_at", { ascending: false })
            .limit(18),

          fetch("/api/labs/trends", {
            credentials: "include",
          }).then((response) => response.json()).catch(() => null),

          fetch("/api/calendar/google/status", {
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
        setCalendarStatus(calendarRes);
        if (wearableRes.data) setWearableRows(wearableRes.data);
        if (connectionRes?.connections) {
          setWearableConnections(connectionRes.connections);
        }
        if (notificationRes?.notifications) {
          setCoachNotifications(notificationRes.notifications);
        }
        if (optimizationRes.data) {
          setOptimizationProtocol(optimizationRes.data as OptimizationProtocolRow);
        }
        if (bioAgeHistoryRes?.history) {
          setBioAgeHistory(bioAgeHistoryRes.history);
        }
        if (bioAgeSimulatorRes?.simulations) {
          setBioAgeSimulations(bioAgeSimulatorRes.simulations);
        }
        if (improvementLoopRes?.loop) {
          setImprovementLoop(improvementLoopRes.loop);
        }
        if (labsRes.data) {
          setLabRows(labsRes.data as LabBiomarkerRow[]);
        }
        if (labTrendsRes?.trends) {
          setLabTrends(labTrendsRes.trends);
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
      if (bioAgeData.history) {
        setBioAgeHistory((prev) => [bioAgeData.history, ...prev].slice(0, 24));
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

      if (reportData.notification) {
        setCoachNotifications((prev) => [
          reportData.notification,
          ...prev,
        ].slice(0, 5));
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
      if (data.biologicalAge?.result?.biologicalAge) {
        setProfile((prev) =>
          prev
            ? { ...prev, biological_age: data.biologicalAge.result.biologicalAge }
            : prev
        );
      }
      if (data.biologicalAge?.history) {
        setBioAgeHistory((prev) => [
          data.biologicalAge.history,
          ...prev,
        ].slice(0, 24));
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

  async function handleLabImport() {
    if (labImporting) return;
    if (!labPayload.trim() && !labImportFile) {
      setLabMessage("Add lab values or upload a report before importing.");
      return;
    }

    try {
      setLabImporting(true);
      setLabMessage("Importing clinical biomarkers...");

      const formData = new FormData();
      if (labPayload.trim()) formData.append("payload", labPayload.trim());
      if (labImportFile) formData.append("file", labImportFile);

      const response = await fetch("/api/labs/import", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Lab import failed.");
      }

      if (data.inserted) {
        setLabRows((prev) => [...data.inserted, ...prev].slice(0, 18));
      }
      const trendsResponse = await fetch("/api/labs/trends", {
        credentials: "include",
      }).then((response) => response.json()).catch(() => null);
      if (trendsResponse?.trends) {
        setLabTrends(trendsResponse.trends);
      }
      if (data.biologicalAge?.result?.biologicalAge) {
        setProfile((prev) =>
          prev
            ? { ...prev, biological_age: data.biologicalAge.result.biologicalAge }
            : prev
        );
      }
      if (data.biologicalAge?.history) {
        setBioAgeHistory((prev) => [
          data.biologicalAge.history,
          ...prev,
        ].slice(0, 24));
      }

      setLabPayload("");
      setLabImportFile(null);
      setLabMessage(`Imported ${data.inserted?.length || 0} biomarkers and refreshed biological age.`);
    } catch (err) {
      setLabMessage(err instanceof Error ? err.message : "Lab import failed.");
    } finally {
      setLabImporting(false);
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
      <div className="min-h-screen flex items-center justify-center">
        <Spinner label="Loading" />
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
  const ageDelta = bioAge && assessmentAge ? roundAgeDelta(bioAge - assessmentAge) : null;
  const latestPriority =
    report?.report?.top_priorities?.[0] || report?.primary_goal || null;
  const latestPriorityDisplay = sentenceDisplay(latestPriority);
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
  const latestLabAt = labRows
    .map((row) => row.measured_at)
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
  const sourceIntelligence = buildDataSourceIntelligence({
    appleRows: wearableRows.filter((row) => row.provider === "apple"),
    calendarConnected: Boolean(calendarStatus?.connected),
    connectedProviders: connectedProviderSet,
    healthState,
    labRows,
    wearableRows,
  });

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
  const systemStatusLabel =
    systemStatus === "STABLE" ? "Trajectory steady"
    : systemStatus === "COMPUTING" ? "Building baseline"
    : systemStatus === "NOT STARTED" ? "Baseline pending"
    : systemStatus === "NEEDS REVIEW" ? "Review recommended"
    : "Priority review";
  const membershipLabel = formatMembershipPlan(profile?.plan);
  const displayName = resolveDisplayName(profile?.display_name) || "there";
  const activationMessage = activatedPlan
    ? {
        core: {
          title: "Core membership",
          body: "Your baseline, assessment, biological age, and first longevity report are ready to build from.",
        },
        elite: {
          title: "Elite membership",
          body: "Your optimization tier is live with proactive coach delivery, wearable-state updates, and deeper regeneration paths.",
        },
        sovereign: {
          title: "Sovereign membership",
          body: "Your executive tier is live with the complete digital-twin path, exports, and concierge-grade intelligence layer.",
        },
      }[activatedPlan]
    : null;
  const intelligenceItems =
    coachNotifications.length > 0
      ? coachNotifications.map((notification) => ({
          id: notification.id,
          title: notification.title,
          body: notification.message,
          status: notification.status,
        }))
      : alerts.map((alert) => ({
          id: alert.id,
          title: alert.title,
          body: alert.recommendation,
          status: alert.severity,
        }));
  const activeProtocol = optimizationProtocol?.protocol || null;
  const protocolActions = activeProtocol?.primary_protocol || [];
  const protocolFocus =
    activeProtocol?.focus_domains ||
    optimizationProtocol?.focus_domains ||
    protocolActions.map((action) => action.domain || "Optimization").slice(0, 3);
  const protocolSummary =
    activeProtocol?.coach_message ||
    optimizationProtocol?.summary ||
    activeProtocol?.summary ||
    "Build your first optimization protocol so Aeonvera can coach from your goals and constraints.";
  const todayPrimaryAction = buildTodayPrimaryAction({
    bioAge,
    hasAssessment,
    latestPriority,
    optimizationProtocol,
    report,
    sourceScore: sourceIntelligence.score,
  });
  const todaySignals = [
    {
      label: "Biological age",
      value: bioAge ? `${bioAge}` : "New",
      detail: bioAge
        ? ageDelta == null
          ? "Baseline active"
          : ageDelta <= 0
            ? `${Math.abs(ageDelta)} years younger than chronological`
            : `${ageDelta} years above chronological`
        : "Complete assessment",
    },
    {
      label: "Data readiness",
      value: `${sourceIntelligence.score}%`,
      detail: sourceIntelligence.headline,
    },
    {
      label: "Plan",
      value: optimizationProtocol ? "Active" : "Open",
      detail: optimizationProtocol ? protocolFocus.slice(0, 2).join(" · ") : "Build first protocol",
    },
  ];

  return (
    <PageContainer>
      <div className="space-y-8 py-14 md:py-16">

        {/* ═══════════════════════════════════════
            HEADER
        ═══════════════════════════════════════ */}
        <div className="pb-10">
          <div className="flex items-start justify-between flex-wrap gap-6">
            <div>
              <p className="micro-label mb-5">
                {currentTime.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
              <h1 className="text-5xl md:text-6xl font-semibold tracking-tight text-white/90 leading-tight">
                {greeting},{" "}
                <br />
                <span className="text-white/50">
                  {displayName}
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
                    : "bg-[rgb(var(--gold))] shadow-[0_0_16px_rgba(var(--gold),0.3)]"
                }`} />
                <span className="av-eyebrow text-white/78">
                  {systemStatusLabel}
                </span>
              </div>
              <p className="av-eyebrow text-white/25">
                {membershipLabel}
              </p>
            </div>
          </div>
          <div className="silver-rule mt-10" />
        </div>

        {activationMessage && (
          <div className="executive-panel-soft rounded-lg border border-white/[0.12] p-5">
            <p className="micro-label">{activationMessage.title}</p>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/58">
              {activationMessage.body}
            </p>
          </div>
        )}

        <TodayBriefing
          action={todayPrimaryAction}
          firstInsight={healthState?.insights?.[0] || (latestPriority ? latestPriorityDisplay : protocolSummary)}
          greeting={greeting}
          name={displayName}
          onAction={() => {
            if (todayPrimaryAction.href === "/report" && hasAssessment && !report) {
              void handleGenerateReport();
              return;
            }

            router.push(todayPrimaryAction.href);
          }}
          signals={todaySignals}
        />

        <div className="grid gap-6 lg:grid-cols-[1.18fr_0.82fr]">

          {/* BIOLOGICAL AGE CARD */}
          <Card title="BIOLOGICAL AGE" glow className="min-h-[340px]">
            {bioAge ? (
              <div className="flex h-full flex-col">
                <div className="dashboard-hero-metric-block grid grid-cols-1 gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-8">
                    <div>
                      <p className="micro-label mb-2">Biological</p>
                      <div className="flex items-baseline gap-3">
                        <p className={`metric-display text-6xl sm:text-7xl md:text-8xl font-semibold tracking-tight leading-none ${bioAgeColor}`}>
                          {bioAge}
                        </p>
                        <span className="text-2xl font-light leading-none text-white/24">yrs</span>
                      </div>
                    </div>
                    {assessmentAge && (
                      <div className="border-t border-white/[0.07] pt-4 sm:min-w-[8rem] sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                        <p className="micro-label mb-2">Chronological</p>
                        <div className="flex items-baseline gap-2">
                          <p className="text-3xl font-semibold leading-none text-white/58">{assessmentAge}</p>
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

                <BioAgeTrend history={bioAgeHistory} currentBioAge={bioAge} />

                <div className="mt-auto border-t border-white/[0.06] pt-5">
                  <div className="flex justify-between micro-label mb-3">
                    <span>Profile Completeness</span>
                    <span>{accuracyScore}%</span>
                  </div>
                  {accuracyScore < 70 && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        router.push("/assessment");
                      }}
                      className="av-eyebrow premium-action-ghost mt-3 transition-colors duration-300"
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
            title="Your report"
            className="min-h-[340px]"
            actionLabel={
              report
                ? "Open your report"
                : hasAssessment
                ? "Generate your report"
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
                  <p className="metric-display text-6xl font-semibold tracking-tight leading-none text-white/86">
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
                  {latestPriorityDisplay}
                </p>

                <div className="mt-auto flex items-center gap-3 border-t border-white/[0.06] pt-5">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      router.push("/report");
                    }}
                    className="av-eyebrow premium-action-secondary inline-flex h-9 items-center justify-center px-4 rounded-md transition-all duration-300"
                  >
                    Open Report
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleGenerateReport();
                    }}
                    disabled={generatingReport}
                    className="av-eyebrow premium-action-ghost transition-colors duration-300 disabled:opacity-30"
                  >
                    {generatingReport ? "Generating..." : "Regenerate"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-white/25 text-sm leading-relaxed">
                  {hasAssessment
                    ? "Your assessment is complete. Generate your first report."
                    : "Complete your assessment to unlock your report."}
                </p>
                {hasAssessment ? (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleGenerateReport();
                    }}
                    disabled={generatingReport}
                    className="av-eyebrow premium-action inline-flex h-9 items-center justify-center px-6 rounded-md transition-all duration-300 disabled:opacity-30"
                  >
                    {generatingReport ? "Generating..." : "Generate your report"}
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
            className={`av-control-card cursor-pointer rounded-lg border p-5 transition ${
              firstReportPrompt && !report
                ? "av-control-card-active"
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
                className="premium-action inline-flex items-center justify-center text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40"
              >
                {generatingReport ? "Generating..." : report ? "Refresh intelligence" : "Generate report"}
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          aria-expanded={showAdvancedConsole}
          onClick={() => setShowAdvancedConsole((value) => !value)}
          className={`av-control-card group flex w-full items-center justify-between gap-4 rounded-lg border px-5 py-4 text-left transition ${
            showAdvancedConsole ? "av-control-card-active" : ""
          }`}
        >
          <div>
            <p className="text-sm font-light">More detail</p>
            <p className="av-control-muted mt-1 text-xs leading-5">
              Labs, wearables, simulations, notification delivery, and detailed protocol tools.
            </p>
          </div>
          <ChevronDown
            size={18}
            className={`shrink-0 transition ${
              showAdvancedConsole ? "rotate-180" : ""
            }`}
          />
        </button>

        {showAdvancedConsole ? (
          <div className="space-y-8">
            <BioAgeSimulationPanel
              simulations={bioAgeSimulations}
              hasAssessment={hasAssessment}
              onOpenOptimization={() => router.push("/optimization")}
              onStartAssessment={() => router.push("/assessment")}
            />

            <ImprovementLoopPanel
              loop={improvementLoop}
              hasAssessment={hasAssessment}
              onOpenOptimization={() => router.push("/optimization")}
              onStartAssessment={() => router.push("/assessment")}
            />

            <DataFreshnessPanel
              appleMetricCount={wearableRows.filter((row) => row.provider === "apple").length}
              connectedProviderSet={connectedProviderSet}
              healthStateAt={healthState?.updated_at || null}
              intelligence={sourceIntelligence}
              labCount={labRows.length}
              latestLabAt={latestLabAt}
              latestWearableAt={latestWearableAt}
              onOpenDataSources={() => router.push("/data-sources")}
            />

            <LabImportPanel
              labRows={labRows}
              labTrends={labTrends}
              labPayload={labPayload}
              labImportFileName={labImportFile?.name || null}
              labImporting={labImporting}
              labMessage={labMessage}
              onLabPayloadChange={setLabPayload}
              onLabImportFileChange={setLabImportFile}
              onLabImport={handleLabImport}
            />

            <ProtocolPanel
              optimizationProtocol={optimizationProtocol}
              protocolActions={protocolActions}
              protocolFocus={protocolFocus}
              protocolSummary={protocolSummary}
              onOpenOptimization={() => router.push("/optimization")}
            />

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
          </div>
        ) : null}

        {/* ═══════════════════════════════════════
            COACH ALERTS
        ═══════════════════════════════════════ */}
        <div>
          <p className="micro-label mb-4">
            Alerts
          </p>
          {intelligenceItems.length > 0 ? (
            <div className="space-y-3">
              {intelligenceItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-4 rounded-lg border border-white/[0.08] bg-white/[0.025] p-4"
                >
                  <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/35" />
                  <div className="flex-1">
                    <p className="text-white/70 text-sm font-light mb-1">{item.title}</p>
                    <p className="text-white/40 text-xs leading-relaxed">{item.body}</p>
                  </div>
                  <span className="av-eyebrow shrink-0 text-white/28">
                    {item.status}
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
            type="button"
            onClick={() => router.push("/assessment")}
            className="av-control-card rounded-lg border p-5 text-left"
          >
            <p className="av-control-muted av-eyebrow mb-3">
              {hasAssessment ? "Update" : "Initialize"}
            </p>
            <p className="text-sm font-light">
              {hasAssessment ? "Update your assessment data" : "Start your assessment"}
            </p>
            <p className="av-eyebrow mt-3">
              {hasAssessment ? "Retake →" : "Start →"}
            </p>
          </button>

          <button
            type="button"
            onClick={() => router.push("/report")}
            className="av-control-card rounded-lg border p-5 text-left"
          >
            <p className="av-control-muted av-eyebrow mb-3">
              Intelligence
            </p>
            <p className="text-sm font-light">
              View your full biological profile and 90-day protocol
            </p>
            <p className="av-eyebrow mt-3">
              Open report →
            </p>
          </button>

          <button
            type="button"
            onClick={() => router.push("/pricing")}
            className="av-control-card rounded-lg border p-5 text-left"
          >
            <p className="av-control-muted av-eyebrow mb-3">
              Account
            </p>
            <p className="text-sm font-light">
              {profile?.plan ? `${profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1)} plan · ${profile.subscription_status}` : "Manage subscription"}
            </p>
            <p className="av-eyebrow mt-3">
              Manage →
            </p>
          </button>
        </div>

      </div>
    </PageContainer>
  );
}

function ProtocolPanel({
  optimizationProtocol,
  protocolActions,
  protocolFocus,
  protocolSummary,
  onOpenOptimization,
}: {
  optimizationProtocol: OptimizationProtocolRow | null;
  protocolActions: NonNullable<OptimizationProtocol["primary_protocol"]>;
  protocolFocus: string[];
  protocolSummary: string;
  onOpenOptimization: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={optimizationProtocol ? "Open active optimization protocol" : "Build optimization protocol"}
      onClick={onOpenOptimization}
      onKeyDown={(event) => {
        if (isInteractiveTarget(event.target)) return;
        if (event.key !== "Enter" && event.key !== " ") return;

        event.preventDefault();
        onOpenOptimization();
      }}
      className="executive-panel-soft quiet-lift cursor-pointer rounded-lg border border-white/[0.08] p-5 transition hover:border-white/[0.16]"
    >
      <div className="grid gap-5 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
        <div>
          <div className="mb-3 flex items-center gap-3">
            <p className="micro-label">Active Optimization Protocol</p>
            <span className="av-eyebrow rounded-md border border-white/[0.08] px-2.5 py-1 text-white/32">
              {optimizationProtocol ? optimizationProtocol.status : "not built"}
            </span>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-white/55">
            {protocolSummary}
          </p>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onOpenOptimization();
            }}
            className="av-eyebrow premium-action-secondary mt-5 inline-flex h-10 items-center justify-center rounded-md px-4"
          >
            {optimizationProtocol ? "Open protocol" : "Build protocol"}
          </button>
        </div>

        {optimizationProtocol ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {protocolActions.slice(0, 3).map((action, index) => (
              <div
                key={`${action.domain || "protocol"}-${index}`}
                className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm text-white/68">
                    {action.domain || protocolFocus[index] || "Focus"}
                  </p>
                  <span className="av-eyebrow text-white/24">
                    {action.impact || "active"}
                  </span>
                </div>
                <p className="line-clamp-3 text-xs leading-5 text-white/38">
                  {action.action || "Follow your active optimization protocol."}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {["Sleep", "Metabolic", "Movement"].map((domain) => (
              <div
                key={domain}
                className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-4"
              >
                <p className="text-sm text-white/58">{domain}</p>
                <p className="mt-2 text-xs leading-5 text-white/32">
                  Waiting for intake
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function buildTodayPrimaryAction({
  bioAge,
  hasAssessment,
  latestPriority,
  optimizationProtocol,
  report,
  sourceScore,
}: {
  bioAge: number | null;
  hasAssessment: boolean;
  latestPriority: string | null;
  optimizationProtocol: OptimizationProtocolRow | null;
  report: Report | null;
  sourceScore: number;
}): TodayPrimaryAction {
  if (!hasAssessment) {
    return {
      body: "Start with the assessment so Aeonvera can calculate baseline risk, biological age, and first priorities.",
      href: "/assessment",
      label: "Start assessment",
      title: "Create your baseline",
    };
  }

  if (!bioAge || !report) {
    return {
      body: "Your assessment is ready. Generate your report to activate your biological age and first health plan.",
      href: "/report",
      label: "Generate report",
      title: "Activate intelligence",
    };
  }

  if (!optimizationProtocol) {
    return {
      body: sentenceDisplay(latestPriority, "Turn your latest report into a short, executable protocol."),
      href: "/optimization",
      label: "Build protocol",
      title: "Choose the next intervention",
    };
  }

  if (sourceScore < 70) {
    return {
      body: "Your model will improve fastest if you refresh labs, wearables, or Apple Health data.",
      href: "/data-sources",
      label: "Refresh data",
      title: "Strengthen the signal",
    };
  }

  return {
    body: sentenceDisplay(latestPriority, "Your baseline and protocol are active. Review the plan and execute the next step."),
    href: "/plan",
    label: "Open plan",
    title: "Execute today’s plan",
  };
}

function BioAgeSimulationPanel({
  simulations,
  hasAssessment,
  onOpenOptimization,
  onStartAssessment,
}: {
  simulations: BioAgeSimulation[];
  hasAssessment: boolean;
  onOpenOptimization: () => void;
  onStartAssessment: () => void;
}) {
  const topSimulation = simulations[0];

  return (
    <Card
      title="BIOLOGICAL AGE SIMULATOR"
      actionLabel={hasAssessment ? "Open optimization" : "Start assessment"}
      onClick={hasAssessment ? onOpenOptimization : onStartAssessment}
    >
      {hasAssessment && topSimulation ? (
        <div className="grid gap-5 lg:grid-cols-[0.92fr_1.08fr] lg:items-stretch">
          <div className="flex flex-col justify-between rounded-lg border border-white/[0.06] bg-white/[0.025] p-5">
            <div>
              <p className="micro-label mb-5">Highest Leverage Scenario</p>
              <div className="flex items-end gap-3">
                <p className="metric-display text-5xl font-semibold leading-none royal-text">
                  {formatYears(topSimulation.projectedAgeDeltaImprovement)}
                </p>
                <p className="mb-1 text-xs uppercase tracking-[0.14em] text-white/25">
                  yrs potential
                </p>
              </div>
              <p className="mt-5 text-lg font-light leading-7 text-white/80">
                {topSimulation.title}
              </p>
              <p className="mt-3 text-sm leading-7 text-white/42">
                {topSimulation.action}
              </p>
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-white/[0.06] pt-4">
              <span className="av-eyebrow text-white/25">
                {topSimulation.horizon}
              </span>
              <span className="av-eyebrow text-white/45">
                {topSimulation.confidence}% confidence
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {simulations.slice(0, 4).map((simulation, index) => (
              <div
                key={simulation.id}
                className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 transition duration-300 hover:border-white/[0.12] hover:bg-white/[0.035]"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <span className="royal-text text-xs tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="av-eyebrow text-white/25">
                    {simulation.domain}
                  </span>
                </div>
                <p className="text-sm font-light leading-6 text-white/76">
                  {simulation.title}
                </p>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <span className="text-xs leading-5 text-white/34">
                    Projected age {simulation.projectedBiologicalAge}
                  </span>
                  <span className="text-sm royal-text">
                    {formatYears(simulation.projectedAgeDeltaImprovement)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <p className="max-w-2xl text-sm leading-7 text-white/42">
            {hasAssessment
              ? "Run a fresh biological age score to unlock projected intervention scenarios."
              : "Complete your assessment so Aeonvera can simulate which changes would move your biological age first."}
          </p>
          <button
            onClick={(event) => {
              event.stopPropagation();
              if (hasAssessment) onOpenOptimization();
              else onStartAssessment();
            }}
            className="av-eyebrow premium-action inline-flex items-center justify-center transition"
          >
            {hasAssessment ? "Open Optimization" : "Start Assessment"}
          </button>
        </div>
      )}
    </Card>
  );
}

function ImprovementLoopPanel({
  loop,
  hasAssessment,
  onOpenOptimization,
  onStartAssessment,
}: {
  loop: ImprovementLoop | null;
  hasAssessment: boolean;
  onOpenOptimization: () => void;
  onStartAssessment: () => void;
}) {
  const action = hasAssessment ? onOpenOptimization : onStartAssessment;

  return (
    <Card
      title="BIOLOGICAL AGE IMPROVEMENT LOOP"
      actionLabel={hasAssessment ? "Take the next step" : "Start assessment"}
      onClick={action}
    >
      {hasAssessment && loop ? (
        <div className="grid gap-5 lg:grid-cols-[0.92fr_1.08fr] lg:items-stretch">
          <div className="flex flex-col justify-between rounded-lg border border-white/[0.06] bg-white/[0.025] p-5">
            <div>
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="micro-label">Next step</p>
                <span className={improvementStatusClassName(loop.status)}>
                  {loop.status}
                </span>
              </div>
              <p className="text-2xl font-light leading-tight text-white/82">
                {loop.headline}
              </p>
              <p className="mt-4 text-sm leading-7 text-white/42">
                {loop.summary}
              </p>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2">
              {[
                ["Tracked", `${loop.daysTracked}d`],
                ["30d pace", loop.pacePer30Days == null ? "new" : `${loop.pacePer30Days > 0 ? "+" : ""}${loop.pacePer30Days}`],
                ["Next step", loop.phase5Ready ? "ready" : "building"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
                  <p className="av-eyebrow text-white/22">{label}</p>
                  <p className="mt-2 text-sm text-white/62">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {loop.drivers.slice(0, 4).map((driver) => (
                <div
                  key={`${driver.label}-${driver.value}`}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="av-eyebrow text-white/24">
                      {driver.label}
                    </p>
                    <span className={driverStatusClassName(driver.status)}>
                      {driver.value}
                    </span>
                  </div>
                  <p className="line-clamp-3 text-xs leading-5 text-white/38">
                    {driver.detail}
                  </p>
                </div>
              ))}
            </div>

            {loop.nextActions[0] && (
              <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-4">
                <p className="micro-label mb-3">Next Action</p>
                <p className="text-sm leading-6 text-white/70">
                  {loop.nextActions[0].action}
                </p>
                <p className="mt-2 text-xs leading-5 text-white/36">
                  {loop.nextActions[0].reason}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm leading-7 text-white/38">
          Generate biological age history, import labs, and build an optimization protocol to take the next step.
        </p>
      )}
    </Card>
  );
}

function LabImportPanel({
  labRows,
  labTrends,
  labPayload,
  labImportFileName,
  labImporting,
  labMessage,
  onLabPayloadChange,
  onLabImportFileChange,
  onLabImport,
}: {
  labRows: LabBiomarkerRow[];
  labTrends: LabTrend[];
  labPayload: string;
  labImportFileName: string | null;
  labImporting: boolean;
  labMessage: string | null;
  onLabPayloadChange: (value: string) => void;
  onLabImportFileChange: (file: File | null) => void;
  onLabImport: () => void;
}) {
  return (
    <Card title="CLINICAL LAB IMPORT" actionLabel="Import clinical labs" onClick={onLabImport}>
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <p className="text-sm leading-7 text-white/45">
            Upload bloodwork or enter values manually to activate the clinical biomarker layer.
          </p>
          {labMessage && (
            <p className="mt-3 text-sm leading-6 royal-text">{labMessage}</p>
          )}

          <textarea
            value={labPayload}
            onChange={(event) => onLabPayloadChange(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            placeholder="Paste your exported lab results here"
            className="executive-input mt-5 h-32 w-full resize-none rounded-lg p-4 text-xs leading-5 placeholder:text-white/16"
          />

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <label
              onClick={(event) => event.stopPropagation()}
              className="av-control-card flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-lg border px-4 py-3 text-xs transition"
            >
              <span className="min-w-0 truncate">
                {labImportFileName || "Upload PDF, CSV, text, or image"}
              </span>
              <span className="av-control-muted av-eyebrow shrink-0">
                Choose
              </span>
              <input
                type="file"
                accept="application/pdf,text/plain,text/csv,.pdf,.csv,.txt,image/png,image/jpeg,image/webp,image/heic,image/heif"
                className="sr-only"
                onChange={(event) =>
                  onLabImportFileChange(event.target.files?.[0] || null)
                }
              />
            </label>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onLabImport();
              }}
              disabled={labImporting}
              className="av-eyebrow premium-action inline-flex h-12 items-center justify-center rounded-md px-5 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {labImporting ? "Importing" : "Import Labs"}
            </button>
          </div>
          {labImportFileName && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onLabImportFileChange(null);
              }}
              className="av-eyebrow premium-action-ghost mt-3 text-left"
            >
              Remove upload
            </button>
          )}
        </div>

        <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <p className="micro-label">Clinical Panel</p>
            <span className="av-eyebrow text-white/30">
              {labRows.length} values
            </span>
          </div>
          {labTrends.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {labTrends.slice(0, 8).map((trend) => (
                <div
                  key={trend.canonicalKey}
                  className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="av-eyebrow text-white/25">
                      {trend.label}
                    </p>
                    <span className={labTrendClassName(trend.status)}>
                      {trend.status}
                    </span>
                  </div>
                  <p className="text-sm text-white/70">
                    {trend.latestValue} {trend.unit || ""}
                  </p>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/34">
                    {trend.interpretation}
                  </p>
                </div>
              ))}
            </div>
          ) : labRows.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {labRows.slice(0, 8).map((row) => (
                <div key={`${row.id}-${row.canonical_key}`} className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
                  <p className="av-eyebrow text-white/25">
                    {formatLabKey(row.canonical_key)}
                  </p>
                  <p className="mt-2 text-sm text-white/70">
                    {Number(row.value).toString()} {row.unit || ""}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-7 text-white/38">
              Waiting for your lab results.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

function DataFreshnessPanel({
  appleMetricCount,
  connectedProviderSet,
  healthStateAt,
  intelligence,
  labCount,
  latestLabAt,
  latestWearableAt,
  onOpenDataSources,
}: {
  appleMetricCount: number;
  connectedProviderSet: Set<"oura" | "whoop">;
  healthStateAt: string | null;
  intelligence: DataSourceIntelligence;
  labCount: number;
  latestLabAt?: string | null;
  latestWearableAt?: string | null;
  onOpenDataSources: () => void;
}) {
  const sources = [
    {
      label: "Oura",
      value: connectedProviderSet.has("oura") ? "Connected" : "Ready",
      detail: connectedProviderSet.has("oura")
        ? `Latest signal ${formatFreshness(latestWearableAt)}`
        : "Connect from Data Sources",
      status: connectedProviderSet.has("oura") ? "active" : "ready",
    },
    {
      label: "Apple Health",
      value: appleMetricCount ? `${appleMetricCount}` : "Ready",
      detail: appleMetricCount
        ? `Imported signal ${formatFreshness(latestWearableAt)}`
        : "Upload export or screenshot",
      status: appleMetricCount ? "active" : "ready",
    },
    {
      label: "Labs",
      value: labCount ? `${labCount}` : "Missing",
      detail: labCount ? `Clinical panel ${formatFreshness(latestLabAt)}` : "Upload bloodwork",
      status: labCount ? "active" : "missing",
    },
    {
      label: "Health State",
      value: healthStateAt ? "Live" : "Building",
      detail: healthStateAt ? `Refreshed ${formatFreshness(healthStateAt)}` : "Waiting for source depth",
      status: healthStateAt ? "active" : "ready",
    },
  ];

  return (
    <div className="executive-panel-soft rounded-lg border border-white/[0.08] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="micro-label">Data Freshness</p>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-white/48">
            {intelligence.headline}
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-4 py-3 text-right">
          <p className="micro-label">Readiness</p>
          <p className="mt-1 text-2xl font-light text-white/80">
            {intelligence.score}%
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenDataSources}
          className="av-eyebrow premium-action-secondary inline-flex h-10 items-center justify-center rounded-md px-4"
        >
          Open Data Sources
        </button>
      </div>

      <p className="mt-4 max-w-4xl text-xs leading-6 text-white/40">
        {intelligence.nextBestAction}
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        {sources.map((source) => (
          <div key={source.label} className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="av-eyebrow text-white/28">
                {source.label}
              </p>
              <span className={dataFreshnessStatusClassName(source.status)}>
                {source.status}
              </span>
            </div>
            <p className="text-lg font-light text-white/78">{source.value}</p>
            <p className="mt-2 text-xs leading-5 text-white/36">{source.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function BioAgeTrend({
  history,
  currentBioAge,
}: {
  history: BioAgeHistoryPoint[];
  currentBioAge: number | null;
}) {
  const points = history
    .slice()
    .reverse()
    .map((point) => ({
      biological: Number(point.biological_age),
      chronological: Number(point.chronological_age),
      createdAt: point.created_at,
    }))
    .filter(
      (point) =>
        Number.isFinite(point.biological) && Number.isFinite(point.chronological)
    );
  const displayPoints =
    points.length > 0
      ? points
      : currentBioAge
      ? [
          {
            biological: currentBioAge,
            chronological: currentBioAge,
            createdAt: new Date().toISOString(),
          },
        ]
      : [];

  if (!displayPoints.length) return null;

  const values = displayPoints.flatMap((point) => [
    point.biological,
    point.chronological,
  ]);
  const min = Math.min(...values) - 1;
  const max = Math.max(...values) + 1;
  const span = Math.max(1, max - min);
  const chartPoints = displayPoints.map((point, index) => {
    const x =
      displayPoints.length === 1
        ? 50
        : (index / (displayPoints.length - 1)) * 100;
    const y = 88 - ((point.biological - min) / span) * 76;
    return `${x},${y}`;
  });
  const chronoPoints = displayPoints.map((point, index) => {
    const x =
      displayPoints.length === 1
        ? 50
        : (index / (displayPoints.length - 1)) * 100;
    const y = 88 - ((point.chronological - min) / span) * 76;
    return `${x},${y}`;
  });
  const first = displayPoints[0];
  const latest = displayPoints[displayPoints.length - 1];
  const change = Number((latest.biological - first.biological).toFixed(1));

  return (
    <div className="mb-5 rounded-lg border border-white/[0.06] bg-white/[0.025] p-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <p className="micro-label">Age Trajectory</p>
        <span className="av-eyebrow text-white/30">
          {displayPoints.length} point{displayPoints.length === 1 ? "" : "s"}
        </span>
      </div>
      <svg viewBox="0 0 100 100" className="h-24 w-full overflow-visible text-white/80" aria-hidden="true">
        <polyline
          points={chronoPoints.join(" ")}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.14}
          strokeWidth="1.5"
          strokeDasharray="3 4"
        />
        <polyline
          points={chartPoints.join(" ")}
          fill="none"
          stroke="rgba(var(--gold),0.86)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {chartPoints.map((point, index) => {
          const [cx, cy] = point.split(",");
          return (
            <circle
              key={`${point}-${index}`}
              cx={cx}
              cy={cy}
              r={index === chartPoints.length - 1 ? "2.8" : "2"}
              fill="currentColor"
              fillOpacity={0.9}
            />
          );
        })}
      </svg>
      <div className="mt-2 flex items-center justify-between gap-4 text-xs leading-5">
        <span className="text-white/36">
          Gold: biological · dashed: chronological
        </span>
        <span className={change <= 0 ? "royal-text" : "text-white/45"}>
          {change === 0
            ? "Stable"
            : change < 0
            ? `${Math.abs(change)} yrs improved`
            : `${change} yrs higher`}
        </span>
      </div>
    </div>
  );
}

function formatYears(value: number) {
  return value > 0 ? value.toFixed(1) : "0.0";
}

function roundAgeDelta(value: number) {
  return Math.round(value * 10) / 10;
}

function formatLabKey(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace("Hscrp", "hsCRP")
    .replace("Mcv", "MCV")
    .replace("Wbc", "WBC");
}

function formatFreshness(value?: string | null) {
  if (!value) return "not yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "not yet";

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.round(diffMs / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function labTrendClassName(status: LabTrend["status"]) {
  const base = "av-eyebrow rounded-md px-2 py-1";

  if (status === "improving") return `${base} royal-text bg-white/[0.035]`;
  if (status === "worsening") return `${base} text-rose-200/70 bg-rose-400/[0.08]`;
  if (status === "stable") return `${base} text-white/34 bg-white/[0.025]`;
  return `${base} text-white/28 bg-white/[0.02]`;
}

function dataFreshnessStatusClassName(status: string) {
  const base = "av-eyebrow rounded-md px-2 py-1";
  if (status === "active") return `${base} royal-text bg-white/[0.035]`;
  if (status === "ready") return `${base} text-white/34 bg-white/[0.025]`;
  return `${base} text-rose-200/60 bg-rose-400/[0.08]`;
}

function improvementStatusClassName(status: ImprovementLoop["status"]) {
  const base = "av-eyebrow rounded-md px-2.5 py-1";

  if (status === "improving") return `${base} royal-text bg-white/[0.035]`;
  if (status === "declining") return `${base} text-rose-200/70 bg-rose-400/[0.08]`;
  if (status === "stable") return `${base} text-white/38 bg-white/[0.025]`;
  return `${base} text-white/28 bg-white/[0.02]`;
}

function driverStatusClassName(status: ImprovementLoop["drivers"][number]["status"]) {
  const base = "av-eyebrow rounded-md px-2 py-1";

  if (status === "positive") return `${base} royal-text bg-white/[0.035]`;
  if (status === "negative") return `${base} text-rose-200/70 bg-rose-400/[0.08]`;
  return `${base} text-white/30 bg-white/[0.025]`;
}
