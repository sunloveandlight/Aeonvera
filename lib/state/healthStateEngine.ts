export type HealthMetric = {
  userId: string;
  metricName: string;
  value: number;
  timestamp: string;
};

export type TrendEntry = {
  direction: "improving" | "declining" | "stable";
  changePercent: number;
};

export type RiskScores = {
  sleep: number;
  recovery: number;
  metabolic: number;
  activity: number;
};

export type HealthState = {
  userId: string;
  baseline: Record<string, number>;
  trends: Record<string, TrendEntry>;
  riskScores: RiskScores;
  insights: string[];
  updatedAt: string;
};

/**
 * MAIN ENTRY
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
function groupByMetric(
  metrics: HealthMetric[]
): Record<string, HealthMetric[]> {
  const grouped: Record<string, HealthMetric[]> = {};

  for (const m of metrics) {
    if (!grouped[m.metricName]) {
      grouped[m.metricName] = [];
    }
    grouped[m.metricName].push(m);
  }

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
function computeBaseline(
  grouped: Record<string, HealthMetric[]>
): Record<string, number> {
  const baseline: Record<string, number> = {};

  for (const key of Object.keys(grouped)) {
    const values: number[] = grouped[key].map((m) => m.value);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    baseline[key] = Number(avg.toFixed(2));
  }

  return baseline;
}

/**
 * TREND ENGINE
 */
function computeTrends(
  grouped: Record<string, HealthMetric[]>
): Record<string, TrendEntry> {
  const trends: Record<string, TrendEntry> = {};

  for (const key of Object.keys(grouped)) {
    const values: number[] = grouped[key].map((m) => m.value);

    if (values.length < 4) {
      trends[key] = { direction: "stable", changePercent: 0 };
      continue;
    }

    const mid = Math.floor(values.length / 2);

    const firstHalf: number[] = values.slice(0, mid);
    const secondHalf: number[] = values.slice(mid);

    const firstAvg =
      firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg =
      secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;

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
 * RISK ENGINE
 * FIXED: explicit number types throughout, safe activity formula
 */
function computeRiskScores(
  baseline: Record<string, number>,
  trends: Record<string, TrendEntry>
): RiskScores {
  const sleep: number = baseline["sleep_hours"] ?? 7;
  const recovery: number = baseline["recovery_score"] ?? 70;
  const steps: number = baseline["daily_steps"] ?? 6000;

  const sleepTrend: number = trends["sleep_hours"]?.changePercent ?? 0;
  const recoveryTrend: number = trends["recovery_score"]?.changePercent ?? 0;

  return {
    sleep: clampRisk(100 - sleep * 12 - sleepTrend),
    recovery: clampRisk(100 - recovery + Math.abs(recoveryTrend)),
    metabolic: clampRisk(50),
    activity: clampRisk(Math.max(0, 100 - steps / 100)),
  };
}

/**
 * INSIGHT GENERATION
 */
function generateInsights(
  baseline: Record<string, number>,
  trends: Record<string, TrendEntry>,
  riskScores: RiskScores
): string[] {
  const insights: string[] = [];

  if (riskScores.sleep > 60) {
    insights.push("Sleep risk elevated — recovery system under strain.");
  }

  if (riskScores.activity > 70) {
    insights.push(
      "Low activity pattern detected — mobility deficit forming."
    );
  }

  if ((trends["sleep_hours"]?.changePercent ?? 0) < -5) {
    insights.push("Sleep is actively declining over time.");
  }

  if ((trends["recovery_score"]?.changePercent ?? 0) < -5) {
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
function clampRisk(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}