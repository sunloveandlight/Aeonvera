import type { LongevityAlert } from "./longevityCoach";

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
