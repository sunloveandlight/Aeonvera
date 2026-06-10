import type { SupabaseClient } from "@supabase/supabase-js";
import type { LabTrend } from "@/lib/labs/labTrends";
import { loadLabTrendsForUser } from "@/lib/labs/loadLabTrendsForUser";

type HistoryRow = {
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

type HealthMetricRow = {
  metric?: string | null;
  value?: number | string | null;
  measured_at?: string | null;
};

type OptimizationProtocolRow = {
  protocol?: {
    primary_protocol?: Array<{
      domain?: string;
      action?: string;
      impact?: "low" | "medium" | "high";
    }>;
    tracking_metrics?: Array<{
      metric?: string;
      target?: string;
      source?: string;
    }>;
  } | null;
  status?: string | null;
  created_at?: string | null;
};

export type ImprovementLoopDriver = {
  label: string;
  value: string;
  status: "positive" | "negative" | "neutral";
  detail: string;
};

export type ImprovementLoopAction = {
  domain: string;
  action: string;
  reason: string;
  impact: "low" | "medium" | "high";
};

export type BiologicalAgeImprovementLoop = {
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
  drivers: ImprovementLoopDriver[];
  nextActions: ImprovementLoopAction[];
};

export async function buildBiologicalAgeImprovementLoop({
  supabase,
  userId,
}: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<BiologicalAgeImprovementLoop> {
  const since = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
  const [historyResult, labTrends, metricsResult, protocolResult] = await Promise.all([
    supabase
      .from("biological_age_history")
      .select("id, chronological_age, biological_age, age_delta, score, accuracy_score, category, source, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(24),
    loadLabTrendsForUser(supabase, userId),
    supabase
      .from("health_metrics")
      .select("metric, value, measured_at")
      .eq("user_id", userId)
      .gte("measured_at", since)
      .order("measured_at", { ascending: false })
      .limit(240),
    supabase
      .from("optimization_protocols")
      .select("protocol, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const history = historyResult.error && isMissingHistoryTable(historyResult.error)
    ? []
    : ((historyResult.data || []) as HistoryRow[]);
  const metrics = (metricsResult.data || []) as HealthMetricRow[];
  const protocol = protocolResult.data as OptimizationProtocolRow | null;

  const latest = history[0];
  const baseline = history.length > 1 ? history[history.length - 1] : null;
  const latestBioAge = numberOrNull(latest?.biological_age);
  const baselineBioAge = numberOrNull(baseline?.biological_age);
  const latestAgeDelta = numberOrNull(latest?.age_delta);
  const baselineAgeDelta = numberOrNull(baseline?.age_delta);
  const latestScore = numberOrNull(latest?.score);
  const baselineScore = numberOrNull(baseline?.score);
  const daysTracked = baseline && latest
    ? Math.max(0, dayDiff(baseline.created_at, latest.created_at))
    : 0;
  const biologicalAgeChange =
    latestBioAge != null && baselineBioAge != null
      ? round(latestBioAge - baselineBioAge, 1)
      : null;
  const ageDeltaChange =
    latestAgeDelta != null && baselineAgeDelta != null
      ? round(latestAgeDelta - baselineAgeDelta, 1)
      : null;
  const scoreChange =
    latestScore != null && baselineScore != null
      ? round(latestScore - baselineScore, 0)
      : null;
  const pacePer30Days =
    ageDeltaChange != null && daysTracked > 0
      ? round((ageDeltaChange / daysTracked) * 30, 1)
      : null;
  const projected90DayChange =
    pacePer30Days != null ? round(pacePer30Days * 3, 1) : null;
  const status = classifyLoopStatus({ ageDeltaChange, historyCount: history.length });
  const drivers = buildDrivers({
    historyCount: history.length,
    ageDeltaChange,
    scoreChange,
    labTrends,
    metrics,
    protocol,
  });
  const nextActions = buildNextActions({ labTrends, metrics, protocol, status });
  const phase4Complete = Boolean(
    latestBioAge != null &&
      history.length >= 2 &&
      (labTrends.length > 0 || metrics.length > 0) &&
      protocol
  );
  const phase5Ready = Boolean(
    latestBioAge != null &&
      history.length >= 2 &&
      nextActions.length > 0
  );

  return {
    status,
    phase4Complete,
    phase5Ready,
    latestBiologicalAge: latestBioAge,
    baselineBiologicalAge: baselineBioAge,
    biologicalAgeChange,
    latestAgeDelta,
    ageDeltaChange,
    scoreChange,
    daysTracked,
    pacePer30Days,
    projected90DayChange,
    headline: buildHeadline({ status, ageDeltaChange, projected90DayChange }),
    summary: buildSummary({ status, labTrends, protocol }),
    drivers,
    nextActions,
  };
}

function buildDrivers({
  historyCount,
  ageDeltaChange,
  scoreChange,
  labTrends,
  metrics,
  protocol,
}: {
  historyCount: number;
  ageDeltaChange: number | null;
  scoreChange: number | null;
  labTrends: LabTrend[];
  metrics: HealthMetricRow[];
  protocol: OptimizationProtocolRow | null;
}): ImprovementLoopDriver[] {
  const drivers: ImprovementLoopDriver[] = [
    {
      label: "Trajectory",
      value: historyCount >= 2 && ageDeltaChange != null ? formatSigned(ageDeltaChange, "yrs") : "building",
      status:
        ageDeltaChange == null
          ? "neutral"
          : ageDeltaChange < -0.2
          ? "positive"
          : ageDeltaChange > 0.2
          ? "negative"
          : "neutral",
      detail:
        historyCount >= 2
          ? "Biological-age delta compared with your first tracked point."
          : "Generate another biological-age point to establish movement.",
    },
  ];

  if (scoreChange != null) {
    drivers.push({
      label: "Score",
      value: formatSigned(scoreChange, "pts"),
      status: scoreChange > 1 ? "positive" : scoreChange < -1 ? "negative" : "neutral",
      detail: "Composite longevity score movement over the tracked window.",
    });
  }

  const primaryLab =
    labTrends.find((trend) => trend.status === "worsening") ||
    labTrends.find((trend) => trend.status === "improving") ||
    labTrends[0];

  if (primaryLab) {
    drivers.push({
      label: primaryLab.label,
      value: primaryLab.status,
      status:
        primaryLab.status === "improving"
          ? "positive"
          : primaryLab.status === "worsening"
          ? "negative"
          : "neutral",
      detail: primaryLab.interpretation,
    });
  }

  const wearableDriver = buildWearableDriver(metrics);
  if (wearableDriver) drivers.push(wearableDriver);

  if (protocol?.protocol?.primary_protocol?.length) {
    drivers.push({
      label: "Protocol",
      value: `${protocol.protocol.primary_protocol.length} active`,
      status: "positive",
      detail: protocol.protocol.primary_protocol[0]?.action || "Optimization protocol is active.",
    });
  }

  return drivers.slice(0, 5);
}

function buildNextActions({
  labTrends,
  metrics,
  protocol,
  status,
}: {
  labTrends: LabTrend[];
  metrics: HealthMetricRow[];
  protocol: OptimizationProtocolRow | null;
  status: BiologicalAgeImprovementLoop["status"];
}): ImprovementLoopAction[] {
  const actions: ImprovementLoopAction[] = [];
  const labPriority = labTrends.find((trend) => trend.status === "worsening");

  if (labPriority) {
    actions.push({
      domain: labPriority.label,
      action: clinicalAction(labPriority),
      reason: labPriority.interpretation,
      impact: labPriority.canonicalKey === "hscrp" || labPriority.canonicalKey === "fasting_glucose" ? "high" : "medium",
    });
  }

  const wearableAction = buildWearableAction(metrics);
  if (wearableAction) actions.push(wearableAction);

  const protocolAction = protocol?.protocol?.primary_protocol?.[0];
  if (protocolAction?.action) {
    actions.push({
      domain: protocolAction.domain || "Protocol",
      action: protocolAction.action,
      reason: "Current optimization protocol priority.",
      impact: protocolAction.impact || "medium",
    });
  }

  if (!actions.length || status === "building") {
    actions.push({
      domain: "Measurement",
      action: "Generate one more biological-age point after your next meaningful data update.",
      reason: "Phase 5 projections need at least two real points to compare against.",
      impact: "medium",
    });
  }

  return dedupeActions(actions).slice(0, 4);
}

function buildWearableDriver(metrics: HealthMetricRow[]): ImprovementLoopDriver | null {
  const restingHr = metricDelta(metrics, ["resting_hr", "resting_heart_rate"]);
  if (restingHr) {
    return {
      label: "Resting HR",
      value: formatSigned(restingHr.delta, "bpm"),
      status: restingHr.delta < 0 ? "positive" : restingHr.delta > 0 ? "negative" : "neutral",
      detail: "Latest wearable trend compared with earlier recent values.",
    };
  }

  const sleep = metricDelta(metrics, ["sleep_hours"]);
  if (sleep) {
    return {
      label: "Sleep",
      value: formatSigned(sleep.delta, "hrs"),
      status: sleep.delta > 0 ? "positive" : sleep.delta < 0 ? "negative" : "neutral",
      detail: "Recent sleep duration trend from health metrics.",
    };
  }

  return null;
}

function buildWearableAction(metrics: HealthMetricRow[]): ImprovementLoopAction | null {
  const restingHr = metricDelta(metrics, ["resting_hr", "resting_heart_rate"]);
  if (restingHr && restingHr.delta > 2) {
    return {
      domain: "Recovery",
      action: "Treat the next 24 hours as a recovery day and protect sleep pressure tonight.",
      reason: "Resting heart rate is moving upward.",
      impact: "medium",
    };
  }

  const sleep = metricDelta(metrics, ["sleep_hours"]);
  if (sleep && sleep.delta < -0.3) {
    return {
      domain: "Sleep",
      action: "Move bedtime 30 minutes earlier for the next three nights.",
      reason: "Sleep duration is trending down.",
      impact: "high",
    };
  }

  return null;
}

function metricDelta(metrics: HealthMetricRow[], names: string[]) {
  const rows = metrics
    .filter((row) => names.includes(row.metric || "") && Number.isFinite(Number(row.value)))
    .sort(
      (a, b) =>
        new Date(String(b.measured_at)).getTime() -
        new Date(String(a.measured_at)).getTime()
    );

  if (rows.length < 4) return null;

  const recent = average(rows.slice(0, 3).map((row) => Number(row.value)));
  const prior = average(rows.slice(3, 10).map((row) => Number(row.value)));
  return { delta: round(recent - prior, 1) };
}

function clinicalAction(trend: LabTrend) {
  switch (trend.canonicalKey) {
    case "fasting_glucose":
      return "Add a 10-minute walk after your two highest-carbohydrate meals for 14 days.";
    case "hscrp":
      return "Run a 7-day recovery and inflammation reset before increasing training intensity.";
    case "albumin":
      return "Increase protein consistency and retest this marker on your next lab cycle.";
    default:
      return `Make ${trend.label} the next protocol marker and retest after the next cycle.`;
  }
}

function classifyLoopStatus({
  ageDeltaChange,
  historyCount,
}: {
  ageDeltaChange: number | null;
  historyCount: number;
}): BiologicalAgeImprovementLoop["status"] {
  if (historyCount < 2 || ageDeltaChange == null) return "building";
  if (ageDeltaChange < -0.2) return "improving";
  if (ageDeltaChange > 0.2) return "declining";
  return "stable";
}

function buildHeadline({
  status,
  ageDeltaChange,
  projected90DayChange,
}: {
  status: BiologicalAgeImprovementLoop["status"];
  ageDeltaChange: number | null;
  projected90DayChange: number | null;
}) {
  if (status === "building") return "Your improvement loop is building.";
  if (status === "improving") {
    return `Biological age is moving down ${formatAbs(ageDeltaChange)}.`;
  }
  if (status === "declining") {
    return `Biological age pressure is up ${formatAbs(ageDeltaChange)}.`;
  }

  return projected90DayChange == null
    ? "Biological age is holding steady."
    : `Current pace projects ${formatSigned(projected90DayChange, "yrs")} over 90 days.`;
}

function buildSummary({
  status,
  labTrends,
  protocol,
}: {
  status: BiologicalAgeImprovementLoop["status"];
  labTrends: LabTrend[];
  protocol: OptimizationProtocolRow | null;
}) {
  if (status === "building") {
    return "Phase 4 is nearly complete. Aeonvera needs another tracked point to prove direction, then Phase 5 can project the future from real movement.";
  }

  const clinical = labTrends.some((trend) => trend.status === "worsening" || trend.status === "improving")
    ? "clinical trends"
    : "current biomarkers";
  const protocolText = protocol ? "your active protocol" : "your next protocol";

  return `Aeonvera is now comparing biological-age movement against ${clinical} and ${protocolText}. This is the bridge into future-self simulation.`;
}

function dedupeActions(actions: ImprovementLoopAction[]) {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = `${action.domain}:${action.action}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function numberOrNull(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function average(values: number[]) {
  const finite = values.filter(Number.isFinite);
  return finite.length
    ? finite.reduce((sum, value) => sum + value, 0) / finite.length
    : 0;
}

function dayDiff(from: string, to: string) {
  return Math.round(
    (new Date(to).getTime() - new Date(from).getTime()) / (24 * 60 * 60 * 1000)
  );
}

function round(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatSigned(value: number, suffix: string) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(Math.abs(value) >= 10 ? 0 : 1)} ${suffix}`;
}

function formatAbs(value: number | null) {
  if (value == null) return "0.0 yrs";
  return `${Math.abs(value).toFixed(1)} yrs`;
}

function isMissingHistoryTable(error: { message?: string; code?: string }) {
  return (
    error.code === "PGRST205" ||
    error.message?.includes("biological_age_history") ||
    error.message?.includes("schema cache")
  );
}
