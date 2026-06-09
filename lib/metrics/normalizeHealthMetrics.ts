import { CanonicalHealthMetric } from "./canonicalHealthMetrics";

/**
 * Raw wearable input format (device-agnostic)
 */
export type RawMetric = {
  userId: string;
  source: "oura" | "apple" | "garmin" | "whoop" | "manual";
  metricName: string;
  value: number;
  timestamp: string;
};

/**
 * Normalized output format (stored in health_metrics table)
 */
export type NormalizedHealthMetric = {
  userId: string;
  metric: CanonicalHealthMetric;
  value: number;
  measured_at: string;
  source: string;
};

/**
 * MAIN NORMALIZATION FUNCTION
 */
export function normalizeHealthMetrics(
  raw: RawMetric[]
): NormalizedHealthMetric[] {
  if (!raw?.length) return [];

  const normalized: NormalizedHealthMetric[] = [];

  for (const m of raw) {
    const metric = mapMetricName(m.source, m.metricName);

    if (!metric) continue; // ignore unknown metrics safely

    normalized.push({
      userId: m.userId,
      metric,
      value: normalizeValue(metric, m.value),
      measured_at: m.timestamp,
      source: m.source,
    });
  }

  return normalized;
}

/**
 * DEVICE → CANONICAL MAPPING LAYER
 */
function mapMetricName(
  source: RawMetric["source"],
  metricName: string
): CanonicalHealthMetric | null {
  switch (source) {
    /**
     * OURA
     */
    case "oura":
      switch (metricName) {
        case "sleep_duration":
          return "sleep_hours";
        case "sleep_efficiency":
          return "sleep_efficiency";
        case "readiness":
          return "recovery_score";
        case "activity_score":
          return "strain_score";
        case "steps":
          return "daily_steps";
        default:
          return null;
      }

    /**
     * APPLE HEALTH
     */
    case "apple":
      switch (metricName) {
        case "step_count":
          return "daily_steps";
        case "heart_rate_variability":
          return "heart_rate_variability";
        case "sleep_hours":
          return "sleep_hours";
        case "resting_heart_rate":
          return "resting_hr";
        case "vo2max":
          return "vo2max";
        default:
          return null;
      }

    /**
     * GARMIN
     */
    case "garmin":
      switch (metricName) {
        case "steps":
          return "daily_steps";
        case "sleep_time":
          return "sleep_hours";
        case "body_battery":
          return "recovery_score";
        default:
          return null;
      }

    /**
     * WHOOP
     */
    case "whoop":
      switch (metricName) {
        case "recovery":
          return "recovery_score";
        case "strain":
          return "strain_score";
        case "sleep":
          return "sleep_hours";
        case "resting_heart_rate":
          return "resting_hr";
        case "heart_rate_variability":
          return "heart_rate_variability";
        default:
          return null;
      }

    /**
     * MANUAL INPUT
     */
    case "manual":
      return metricName as CanonicalHealthMetric;

    default:
      return null;
  }
}

/**
 * VALUE NORMALIZATION (future-proofing)
 * Example: scale or convert units if needed
 */
function normalizeValue(
  metric: CanonicalHealthMetric,
  value: number
): number {
  switch (metric) {
    case "sleep_hours":
      return Math.min(24, Math.max(0, value));

    case "daily_steps":
      return Math.max(0, Math.round(value));

    case "heart_rate_variability":
      return Math.max(0, value);

    default:
      return value;
  }
}
