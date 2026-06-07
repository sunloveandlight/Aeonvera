/**
 * Aeonvera — Health State Engine (V1)
 * -----------------------------------
 * This is the "memory layer" of the entire system.
 *
 * It converts raw time-series health metrics into:
 * - Baseline physiology
 * - Trends over time
 * - Risk signals
 * - Stable user health state object
 *
 * This is REQUIRED for:
 * - digital twin
 * - proactive coaching
 * - prediction systems
 */

export type HealthMetric = {
  userId: string;
  metricName: string;
  value: number;
  timestamp: string;
};

export type HealthState = {
  userId: string;

  // Core baselines (long-term averages)
  baseline: Record<string, number>;

  // Short-term trends (directional movement)
  trends: Record<
    string,
    {
      direction: "improving" | "declining" | "stable";
      changePercent: number;
    }
  >;

  // Risk scoring (0–100)
  riskScores: {
    sleep: number;
    recovery: number;
    metabolic: number;
    activity: number;
  };

  // Computed insights
  insights: string[];

  // Last updated timestamp
  updatedAt: string;
};

/**
 * MAIN ENTRY
 * Builds a full health state from raw metrics
 */
export function buildHealthState(metrics: HealthMetric[]): HealthState | null {
  if (!metrics || metrics.length === 0) return null;

  const userId = metrics[0].userId;

  const grouped = groupByMetric(metrics);

  const baseline = computeBaseline(grouped);
  const trends = computeTrends(grouped);
  const riskScores = computeRiskScores(baseline, trends);
  const insights = generateInsights(baseline, trends, riskScores);

  return {
    userId,
    baseline,
    trends,
    riskScores,
    insights,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * GROUP METRICS BY TYPE
 */
function groupByMetric(metrics: HealthMetric[]) {
  const grouped: Record<string, HealthMetric[]> = {};

  for (const m of metrics) {
    if (!grouped[m.metricName]) {
      grouped[m.metricName] = [];
    }
    grouped[m.metricName].push(m);
  }

  // sort each group by time
  for (const key of Object.keys(grouped)) {
    grouped[key].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  return grouped;
}

/**
 * BASELINE = long-term average
 */
function computeBaseline(grouped: Record<string, HealthMetric[]>) {
  const baseline: Record<string, number> = {};

  for (const key of Object.keys(grouped)) {
    const values = grouped[key].map((m) => m.value);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    baseline[key] = Number(avg.toFixed(2));
  }

  return baseline;
}

/**
 * TREND ENGINE
 * compares first half vs second half of data
 */
function computeTrends(grouped: Record<string, HealthMetric[]>) {
  const trends: HealthState["trends"] = {} as any;

  for (const key of Object.keys(grouped)) {
    const values = grouped[key].map((m) => m.value);

    if (values.length < 4) {
      trends[key] = {
        direction: "stable",
        changePercent: 0,
      };
      continue;
    }

    const mid = Math.floor(values.length / 2);

    const firstHalf =
      values.slice(0, mid).reduce((a, b) => a + b, 0) / mid;

    const secondHalf =
      values.slice(mid).reduce((a, b) => a + b, 0) /
      (values.length - mid);

    const changePercent =
      ((secondHalf - firstHalf) / firstHalf) * 100;

    trends[key] = {
      direction:
        changePercent > 2
          ? "improving"
          : changePercent < -2
          ? "declining"
          : "stable",
      changePercent: Number(changePercent.toFixed(2)),
    };
  }

  return trends;
}

/**
 * RISK ENGINE (simple V1 scoring)
 */
function computeRiskScores(
  baseline: Record<string, number>,
  trends: HealthState["trends"]
) {
  const sleep = baseline["sleep_hours"] ?? 7;
  const recovery = baseline["recovery_score"] ?? 70;
  const steps = baseline["daily_steps"] ?? 6000;

  const sleepTrend = trends["sleep_hours"]?.changePercent ?? 0;
  const recoveryTrend = trends["recovery_score"]?.changePercent ?? 0;

  return {
    sleep: clampRisk(100 - sleep * 12 - sleepTrend),
    recovery: clampRisk(100 - recovery + Math.abs(recoveryTrend)),
    metabolic: clampRisk(50), // placeholder until biomarker integration
    activity: clampRisk(100 - steps / 100),
  };
}

/**
 * INSIGHT GENERATION (deterministic V1)
 */
function generateInsights(
  baseline: Record<string, number>,
  trends: HealthState["trends"],
  riskScores: HealthState["riskScores"]
) {
  const insights: string[] = [];

  if (riskScores.sleep > 60) {
    insights.push("Sleep risk elevated — recovery system under strain.");
  }

  if (riskScores.activity > 70) {
    insights.push("Low activity pattern detected — mobility deficit forming.");
  }

  if ((trends.sleep_hours?.changePercent ?? 0) < -5) {
    insights.push("Sleep is actively declining over time.");
  }

  if ((trends.recovery_score?.changePercent ?? 0) < -5) {
    insights.push("Recovery capacity is decreasing.");
  }

  if (insights.length === 0) {
    insights.push("Health state is currently stable.");
  }

  return insights;
}

/**
 * UTILITY
 */
function clampRisk(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}