import type { LongevityAlert } from "./longevityCoach";
import type { LabTrend } from "@/lib/labs/labTrends";
import type { ExecutionSummary } from "@/lib/execution/executionSummary";

type OptimizationAction = {
  domain?: string;
  action?: string;
  why?: string;
  impact?: "low" | "medium" | "high";
};

export type OptimizationProtocol = {
  summary?: string;
  focus_domains?: string[];
  primary_protocol?: OptimizationAction[];
  coach_message?: string;
};

type HealthMetricRow = {
  metric?: string | null;
  value?: number | string | null;
  measured_at?: string | null;
};

type NotificationRow = {
  title?: string | null;
  message?: string | null;
  created_at?: string | null;
  payload?: Record<string, unknown> | null;
};

type ReportRow = {
  risk_score?: number | string | null;
  primary_goal?: string | null;
  created_at?: string | null;
  report?: {
    top_priorities?: string[];
    strengths?: string[];
    weaknesses?: string[];
  } | null;
};

type BehaviorEventRow = {
  domain?: string | null;
  action?: string | null;
  outcome?: string | null;
  created_at?: string | null;
};

export type AdaptiveCoachContext = {
  metrics: HealthMetricRow[];
  recentNotifications: NotificationRow[];
  latestReport?: ReportRow | null;
  recentBehaviorEvents: BehaviorEventRow[];
  labTrends?: LabTrend[];
  executionSummary?: ExecutionSummary | null;
};

export type AdaptiveCoachDecision = {
  shouldSend: boolean;
  reason: string;
  alerts: LongevityAlert[];
  mode: "notification" | "dashboard" | "silent";
  intensity: "high" | "medium" | "low" | "silent";
  memoryTags: string[];
};

type TrendSignal = {
  domain: LongevityAlert["type"];
  title: string;
  message: string;
  recommendation: string;
  severity: LongevityAlert["severity"];
  confidence: number;
  priority: number;
  tag: string;
};

const METRIC_RULES: Record<
  string,
  {
    domain: LongevityAlert["type"];
    label: string;
    threshold: number;
    higherIsBetter: boolean;
    unit?: string;
  }
> = {
  sleep_hours: {
    domain: "sleep",
    label: "sleep duration",
    threshold: 0.4,
    higherIsBetter: true,
    unit: "h",
  },
  recovery_score: {
    domain: "recovery",
    label: "recovery score",
    threshold: 8,
    higherIsBetter: true,
  },
  daily_steps: {
    domain: "activity",
    label: "daily movement",
    threshold: 1200,
    higherIsBetter: true,
  },
  resting_hr: {
    domain: "recovery",
    label: "resting heart rate",
    threshold: 3,
    higherIsBetter: false,
    unit: " bpm",
  },
  hrv: {
    domain: "recovery",
    label: "HRV",
    threshold: 5,
    higherIsBetter: true,
  },
  vo2_max: {
    domain: "activity",
    label: "VO2 max",
    threshold: 1.5,
    higherIsBetter: true,
  },
  protein_intake: {
    domain: "nutrition",
    label: "protein intake",
    threshold: 10,
    higherIsBetter: true,
    unit: "g",
  },
};

export function buildAdaptiveCoachDecision({
  baseAlerts,
  optimizationProtocol,
  context,
}: {
  baseAlerts: LongevityAlert[];
  optimizationProtocol?: OptimizationProtocol | null;
  context: AdaptiveCoachContext;
}): AdaptiveCoachDecision {
  const recentTags = buildRecentTagSet(context.recentNotifications);
  const trendSignals = buildTrendSignals(context.metrics)
    .filter((signal) => !recentTags.has(signal.tag))
    .sort((a, b) => b.priority - a.priority);
  const labSignals = buildLabTrendSignals(context.labTrends || [])
    .filter((signal) => !recentTags.has(signal.tag))
    .sort((a, b) => b.priority - a.priority);
  const executionSignals = buildExecutionSignals(context.executionSummary)
    .filter((signal) => !recentTags.has(signal.tag))
    .sort((a, b) => b.priority - a.priority);
  const unrepeatedBaseAlerts = baseAlerts.filter(
    (alert) => !recentTags.has(alertTag(alert))
  );
  const severeBaseAlerts = baseAlerts.filter((alert) => alert.severity === "high");
  const alerts = [...unrepeatedBaseAlerts];
  const memoryTags = alerts.map(alertTag);

  if (trendSignals.length > 0) {
    const primaryTrend = trendSignals[0];
    alerts.push(signalToAlert(primaryTrend));
    memoryTags.push(primaryTrend.tag);
  }

  if (labSignals.length > 0) {
    const primaryLabTrend = labSignals[0];
    alerts.push(signalToAlert(primaryLabTrend));
    memoryTags.push(primaryLabTrend.tag);
  }

  if (executionSignals.length > 0) {
    const primaryExecutionSignal = executionSignals[0];
    alerts.push(signalToAlert(primaryExecutionSignal));
    memoryTags.push(primaryExecutionSignal.tag);
  }

  if (alerts.length === 0 && optimizationProtocol) {
    const protocolAlert = buildProtocolAlert(optimizationProtocol);

    if (!recentTags.has(alertTag(protocolAlert))) {
      alerts.push(protocolAlert);
      memoryTags.push(alertTag(protocolAlert));
    }
  }

  if (alerts.length === 0 && shouldSendReportNudge(context, recentTags)) {
    const reportAlert = buildReportNudge(context.latestReport);
    alerts.push(reportAlert);
    memoryTags.push(alertTag(reportAlert));
  }

  if (alerts.length === 0) {
    return {
      shouldSend: false,
      reason: "No meaningful new health change, alert, or protocol nudge.",
      alerts: [],
      mode: "silent",
      intensity: "silent",
      memoryTags: [],
    };
  }

  const hasHighSeverity = alerts.some((alert) => alert.severity === "high");
  const hasSevereSuppressedBase = severeBaseAlerts.length > 0 && alerts.length === 0;
  const intensity = hasHighSeverity || hasSevereSuppressedBase ? "high" : "medium";

  return {
    shouldSend: true,
    reason: trendSignals.length
      ? "Meaningful health trend detected."
      : labSignals.length
      ? "Meaningful clinical biomarker trend detected."
      : executionSignals.length
      ? "Execution pattern requires coach adjustment."
      : optimizationProtocol
      ? "Active optimization protocol nudge due."
      : "Coach alert due.",
    alerts,
    mode: intensity === "high" ? "notification" : "dashboard",
    intensity,
    memoryTags,
  };
}

export function buildAdaptiveInterventions(alerts: LongevityAlert[]) {
  return alerts.map((alert) => ({
    domain: alert.type,
    action: alert.recommendation,
    reason: alert.message,
    priority: alert.severity === "high" ? 10 : alert.severity === "medium" ? 7 : 4,
  }));
}

function buildTrendSignals(metrics: HealthMetricRow[]): TrendSignal[] {
  const grouped = groupMetrics(metrics);
  const signals: TrendSignal[] = [];

  for (const [metric, rows] of Object.entries(grouped)) {
    const rule = METRIC_RULES[metric];
    if (!rule || rows.length < 4) continue;

    const recent = rows.slice(0, 3);
    const prior = rows.slice(3, 10);
    if (prior.length < 2) continue;

    const recentAverage = average(recent.map((row) => Number(row.value)));
    const priorAverage = average(prior.map((row) => Number(row.value)));
    const delta = recentAverage - priorAverage;
    const magnitude = Math.abs(delta);

    if (!Number.isFinite(delta) || magnitude < rule.threshold) continue;

    const improved = rule.higherIsBetter ? delta > 0 : delta < 0;
    const formattedDelta = formatDelta(magnitude, rule.unit);

    signals.push({
      domain: rule.domain,
      title: improved
        ? `${capitalize(rule.label)} is improving`
        : `${capitalize(rule.label)} needs attention`,
      message: improved
        ? `${capitalize(rule.label)} improved by ${formattedDelta} versus your recent baseline.`
        : `${capitalize(rule.label)} moved against your baseline by ${formattedDelta}.`,
      recommendation: improved
        ? `Keep the current rhythm for another week so Aeonvera can confirm the pattern.`
        : buildTrendRecommendation(metric),
      severity: improved ? "low" : magnitude >= rule.threshold * 2 ? "high" : "medium",
      confidence: improved ? 0.72 : 0.82,
      priority: improved ? 5 : magnitude >= rule.threshold * 2 ? 10 : 8,
      tag: `trend:${metric}:${improved ? "improving" : "worsening"}`,
    });
  }

  return signals;
}

function buildLabTrendSignals(trends: LabTrend[]): TrendSignal[] {
  return trends.flatMap((trend) => {
    if (trend.status !== "worsening" && trend.status !== "improving") {
      return [];
    }

    const domain = clinicalDomain(trend);
    const unit = trend.unit ? ` ${trend.unit}` : "";
    const delta =
      trend.delta == null
        ? ""
        : ` by ${Math.abs(trend.delta)}${unit}${
            trend.percentChange == null ? "" : ` (${Math.abs(trend.percentChange)}%)`
          }`;
    const worsening = trend.status === "worsening";

    return [
      {
        domain,
        title: worsening
          ? `${trend.label} needs attention`
          : `${trend.label} is improving`,
        message: worsening
          ? `${trend.label} moved away from target${delta}. Latest value: ${trend.latestValue}${unit}.`
          : `${trend.label} is moving in a favorable direction${delta}. Latest value: ${trend.latestValue}${unit}.`,
        recommendation: worsening
          ? buildLabTrendRecommendation(trend)
          : `Keep the current protocol steady and retest ${trend.label} on your next lab cycle.`,
        severity: worsening ? clinicalSeverity(trend) : "low",
        confidence: worsening ? 0.84 : 0.74,
        priority: worsening ? clinicalPriority(trend) : 5,
        tag: `lab:${trend.canonicalKey}:${trend.status}`,
      },
    ];
  });
}

function buildExecutionSignals(summary?: ExecutionSummary | null): TrendSignal[] {
  if (!summary || summary.status === "building") return [];

  const signals: TrendSignal[] = [];

  if (summary.total >= 3 && summary.score < 50) {
    signals.push({
      domain: "activity",
      title: "Execution needs simplifying",
      message: `Your execution score is ${summary.score}% this week. ${summary.skipped} action${summary.skipped === 1 ? "" : "s"} were skipped.`,
      recommendation:
        summary.topSkippedPattern?.actions?.[0] ||
        "Choose one smaller protocol action today and remove the lowest-priority item.",
      severity: summary.score < 35 ? "high" : "medium",
      confidence: 0.86,
      priority: summary.score < 35 ? 11 : 9,
      tag: "execution:low-adherence",
    });
  }

  if (summary.topSkippedPattern && summary.topSkippedPattern.count >= 2) {
    signals.push({
      domain: executionDomain(summary.topSkippedPattern.label),
      title: `${summary.topSkippedPattern.label} is being skipped`,
      message: `${summary.topSkippedPattern.label} actions were skipped ${summary.topSkippedPattern.count} times this week.`,
      recommendation:
        summary.topSkippedPattern.actions[0] ||
        `Reduce the ${summary.topSkippedPattern.label.toLowerCase()} target and schedule it earlier in the day.`,
      severity: summary.topSkippedPattern.count >= 3 ? "medium" : "low",
      confidence: 0.8,
      priority: summary.topSkippedPattern.count >= 3 ? 8 : 6,
      tag: `execution:skipped:${summary.topSkippedPattern.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    });
  }

  if (summary.scheduled > 0 && summary.total === 0) {
    signals.push({
      domain: "risk",
      title: "Calendar is scheduled, completion is missing",
      message: `${summary.scheduled} calendar block${summary.scheduled === 1 ? "" : "s"} are scheduled, but no completion signal was recorded this week.`,
      recommendation:
        "After the next protocol block, mark it Done, Skip, or Later so Aeonvera can adapt.",
      severity: "low",
      confidence: 0.72,
      priority: 5,
      tag: "execution:scheduled-no-feedback",
    });
  }

  if (summary.total >= 3 && summary.score >= 80) {
    signals.push({
      domain: "activity",
      title: "Execution is strong",
      message: `Your execution score is ${summary.score}% this week across ${summary.total} actions.`,
      recommendation:
        "Keep the current protocol stable for another week so Aeonvera can confirm the pattern.",
      severity: "low",
      confidence: 0.74,
      priority: 4,
      tag: "execution:strong-adherence",
    });
  }

  return signals;
}

function groupMetrics(metrics: HealthMetricRow[]) {
  return metrics.reduce<Record<string, HealthMetricRow[]>>((groups, metric) => {
    if (!metric.metric || !metric.measured_at || !Number.isFinite(Number(metric.value))) {
      return groups;
    }

    groups[metric.metric] ||= [];
    groups[metric.metric].push(metric);
    groups[metric.metric].sort(
      (a, b) =>
        new Date(String(b.measured_at)).getTime() -
        new Date(String(a.measured_at)).getTime()
    );

    return groups;
  }, {});
}

function signalToAlert(signal: TrendSignal): LongevityAlert {
  return {
    type: signal.domain,
    severity: signal.severity,
    title: signal.title,
    message: signal.message,
    recommendation: signal.recommendation,
    confidence: signal.confidence,
  };
}

function buildProtocolAlert(protocol: OptimizationProtocol): LongevityAlert {
  const action = protocol.primary_protocol?.[0];

  return {
    type: normalizeDomain(action?.domain),
    severity: action?.impact === "high" ? "medium" : "low",
    title: "Optimization protocol focus",
    message:
      protocol.coach_message ||
      protocol.summary ||
      "Your optimization protocol is active.",
    recommendation:
      action?.action ||
      protocol.focus_domains?.[0] ||
      "Review your active optimization protocol.",
    confidence: 0.76,
  };
}

function shouldSendReportNudge(
  context: AdaptiveCoachContext,
  recentTags: Set<string>
) {
  if (!context.latestReport || recentTags.has("report:priority")) return false;

  const reportAgeDays = daysSinceReport(context.latestReport);
  return reportAgeDays >= 7;
}

function buildReportNudge(report?: ReportRow | null): LongevityAlert {
  const priority =
    report?.report?.top_priorities?.[0] ||
    report?.primary_goal ||
    "Regenerate your longevity report with the newest data.";

  return {
    type: "risk",
    severity: "low",
    title: "Longevity report review",
    message: "Your latest intelligence report is ready for a weekly review.",
    recommendation: priority,
    confidence: 0.68,
  };
}

function buildRecentTagSet(notifications: NotificationRow[]) {
  const recent = new Set<string>();
  const cutoff = Date.now() - 36 * 60 * 60 * 1000;

  for (const notification of notifications) {
    const createdAt = notification.created_at
      ? new Date(notification.created_at).getTime()
      : 0;

    if (createdAt < cutoff) continue;

    const payloadTags = Array.isArray(notification.payload?.coach_memory_tags)
      ? notification.payload?.coach_memory_tags
      : [];

    for (const tag of payloadTags) {
      if (typeof tag === "string") recent.add(tag);
    }

    if (notification.title?.includes("Optimization protocol focus")) {
      recent.add("alert:optimization-protocol-focus");
    }

    if (notification.title?.includes("Longevity report review")) {
      recent.add("report:priority");
    }
  }

  return recent;
}

function alertTag(alert: LongevityAlert) {
  return `alert:${alert.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function normalizeDomain(domain?: string): LongevityAlert["type"] {
  const value = domain?.toLowerCase() || "";

  if (value.includes("sleep")) return "sleep";
  if (value.includes("recover") || value.includes("stress")) return "recovery";
  if (value.includes("nutrition") || value.includes("metabolic")) return "nutrition";
  if (value.includes("movement") || value.includes("training") || value.includes("activity")) {
    return "activity";
  }

  return "risk";
}

function executionDomain(label?: string): LongevityAlert["type"] {
  const value = label?.toLowerCase() || "";

  if (value.includes("sleep")) return "sleep";
  if (value.includes("nutrition")) return "nutrition";
  if (value.includes("training") || value.includes("activity")) return "activity";
  if (value.includes("check")) return "risk";

  return "activity";
}

function buildTrendRecommendation(metric: string) {
  switch (metric) {
    case "sleep_hours":
      return "Protect a consistent wake time tonight and move bedtime 30 minutes earlier.";
    case "recovery_score":
      return "Reduce training intensity for 24 hours and prioritize sleep pressure tonight.";
    case "daily_steps":
      return "Add one 20-minute walk before the end of the day.";
    case "resting_hr":
      return "Treat today as a recovery day and avoid late caffeine or alcohol.";
    case "hrv":
      return "Use a lower-intensity day and add a 10-minute downshift before bed.";
    case "protein_intake":
      return "Anchor your first meal with a complete protein source.";
    default:
      return "Review your protocol and tighten the next small behavior.";
  }
}

function buildLabTrendRecommendation(trend: LabTrend) {
  switch (trend.canonicalKey) {
    case "fasting_glucose":
      return "Prioritize a 10-minute walk after your two highest-carbohydrate meals and tighten the first meal around protein.";
    case "hscrp":
      return "Reduce training intensity for 48 hours, protect sleep, and remove the most obvious inflammatory trigger this week.";
    case "albumin":
      return "Increase protein consistency and review hydration before the next lab draw.";
    case "creatinine":
      return "Review hydration, training load, and creatine use before interpreting the next result.";
    case "lymphocyte_pct":
    case "white_blood_cell_count":
      return "Treat this as an immune-system trend to watch; prioritize recovery, sleep, and retesting context.";
    case "mean_cell_volume":
    case "red_cell_distribution_width":
      return "Review nutrition consistency and discuss persistent red-cell marker changes with a clinician.";
    case "alkaline_phosphatase":
      return "Track this alongside nutrition, training load, and liver/bone context on the next lab cycle.";
    default:
      return "Use this clinical trend as the next protocol priority and retest on your next lab cycle.";
  }
}

function clinicalDomain(trend: LabTrend): LongevityAlert["type"] {
  if (trend.canonicalKey === "fasting_glucose" || trend.canonicalKey === "albumin") {
    return "nutrition";
  }

  if (trend.canonicalKey === "hscrp") return "recovery";

  return "risk";
}

function clinicalSeverity(trend: LabTrend): LongevityAlert["severity"] {
  if (trend.canonicalKey === "hscrp" || trend.canonicalKey === "fasting_glucose") {
    return "high";
  }

  return "medium";
}

function clinicalPriority(trend: LabTrend) {
  if (trend.canonicalKey === "hscrp" || trend.canonicalKey === "fasting_glucose") {
    return 11;
  }

  return 9;
}

function daysSinceReport(report: ReportRow) {
  const createdAt = report.created_at || "";
  const timestamp = createdAt ? new Date(createdAt).getTime() : Date.now();
  return Math.floor((Date.now() - timestamp) / (24 * 60 * 60 * 1000));
}

function average(values: number[]) {
  const finite = values.filter(Number.isFinite);
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function formatDelta(value: number, unit = "") {
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)}${unit}`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
