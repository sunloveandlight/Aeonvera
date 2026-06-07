export type HealthMetric = {
  userId: string;
  metricName: string;
  value: number;
  timestamp: string;
};

export type LongevityAlert = {
  type: "sleep" | "recovery" | "activity" | "nutrition" | "risk";
  severity: "low" | "medium" | "high";
  title: string;
  message: string;
  recommendation: string;
  confidence: number;
};

/**
 * Aeonvera Longevity Coach Engine (V1)
 * ------------------------------------
 * Converts health metrics into actionable interventions.
 *
 * This is a RULE-BASED intelligence layer (no AI dependency yet).
 */
export function runLongevityCoach(
  metrics: HealthMetric[]
): LongevityAlert[] {
  const alerts: LongevityAlert[] = [];

  if (!metrics || metrics.length === 0) return alerts;

  const latest = getLatest(metrics);

  // -------------------------
  // SLEEP LOGIC
  // -------------------------
  const sleep = latest["sleep_hours"];
  if (sleep && sleep.value < 6.5) {
    alerts.push({
      type: "sleep",
      severity: sleep.value < 5.5 ? "high" : "medium",
      title: "Sleep below optimal range",
      message: `Sleep is ${sleep.value.toFixed(1)} hours.`,
      recommendation:
        "Move bedtime earlier by 30–60 minutes and avoid screens before sleep.",
      confidence: 0.8,
    });
  }

  // -------------------------
  // ACTIVITY LOGIC
  // -------------------------
  const steps = latest["daily_steps"];
  if (steps && steps.value < 5000) {
    alerts.push({
      type: "activity",
      severity: steps.value < 3000 ? "high" : "medium",
      title: "Low daily movement detected",
      message: `Only ${Math.round(steps.value)} steps today.`,
      recommendation:
        "Take a 20–30 minute walk and aim for at least 7,000 steps daily.",
      confidence: 0.75,
    });
  }

  // -------------------------
  // RECOVERY LOGIC
  // -------------------------
  const recovery = latest["recovery_score"];
  const activity = latest["activity_load"];

  if (recovery && activity) {
    const imbalance = activity.value - recovery.value;

    if (imbalance > 25) {
      alerts.push({
        type: "recovery",
        severity: imbalance > 40 ? "high" : "medium",
        title: "Recovery imbalance detected",
        message:
          "Your activity exceeds your recovery capacity.",
        recommendation:
          "Reduce training intensity for 48–72 hours and prioritize sleep.",
        confidence: 0.78,
      });
    }
  }

  // -------------------------
  // NUTRITION LOGIC
  // -------------------------
  const protein = latest["protein_intake"];
  if (protein && protein.value < 70) {
    alerts.push({
      type: "nutrition",
      severity: "medium",
      title: "Low protein intake",
      message: "Protein intake is below optimal threshold.",
      recommendation:
        "Increase protein via whole foods (eggs, fish, lean meats, legumes).",
      confidence: 0.7,
    });
  }

  return alerts;
}

/**
 * Extract latest metric per type
 */
function getLatest(metrics: HealthMetric[]) {
  const latest: Record<string, HealthMetric> = {};

  for (const m of metrics) {
    const existing = latest[m.metricName];

    if (
      !existing ||
      new Date(m.timestamp).getTime() >
        new Date(existing.timestamp).getTime()
    ) {
      latest[m.metricName] = m;
    }
  }

  return latest;
}