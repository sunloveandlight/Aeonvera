import type { WearableRawMetric } from "./types";

type WhoopEnvelope<T> = { records?: T[] };
type WhoopSleep = {
  end?: string;
  score?: {
    sleep_performance_percentage?: number;
    stage_summary?: { total_in_bed_time_milli?: number };
  };
};
type WhoopRecovery = {
  created_at?: string;
  score?: {
    recovery_score?: number;
    resting_heart_rate?: number;
    hrv_rmssd_milli?: number;
  };
};
type WhoopCycle = {
  end?: string;
  score?: { strain?: number };
};

const WHOOP_BASE_URL = "https://api.prod.whoop.com/developer/v2";

export async function fetchWhoopMetrics({
  accessToken,
  startDate,
  endDate,
}: {
  accessToken: string;
  startDate: string;
  endDate: string;
}): Promise<WearableRawMetric[]> {
  const [sleep, recovery, cycle] = await Promise.all([
    fetchWhoop<WhoopSleep>("activity/sleep", accessToken, startDate, endDate),
    fetchWhoop<WhoopRecovery>("recovery", accessToken, startDate, endDate),
    fetchWhoop<WhoopCycle>("cycle", accessToken, startDate, endDate),
  ]);

  return [
    ...sleep.flatMap((entry) => {
      const timestamp = normalizeTimestamp(entry.end);
      const sleepMs = entry.score?.stage_summary?.total_in_bed_time_milli;

      if (!timestamp || !Number.isFinite(sleepMs)) return [];

      return [{
        metricName: "sleep",
        value: Number(sleepMs) / 36e5,
        timestamp,
      }];
    }),
    ...recovery.flatMap((entry) => {
      const timestamp = normalizeTimestamp(entry.created_at);
      if (!timestamp) return [];

      return [
        Number.isFinite(entry.score?.recovery_score)
          ? {
              metricName: "recovery",
              value: Number(entry.score?.recovery_score),
              timestamp,
            }
          : null,
        Number.isFinite(entry.score?.resting_heart_rate)
          ? {
              metricName: "resting_heart_rate",
              value: Number(entry.score?.resting_heart_rate),
              timestamp,
            }
          : null,
        Number.isFinite(entry.score?.hrv_rmssd_milli)
          ? {
              metricName: "heart_rate_variability",
              value: Number(entry.score?.hrv_rmssd_milli),
              timestamp,
            }
          : null,
      ].filter(Boolean) as WearableRawMetric[];
    }),
    ...cycle.flatMap((entry) => {
      const timestamp = normalizeTimestamp(entry.end);
      if (!timestamp || !Number.isFinite(entry.score?.strain)) return [];

      return [{ metricName: "strain", value: Number(entry.score?.strain), timestamp }];
    }),
  ];
}

async function fetchWhoop<T>(
  path: string,
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<T[]> {
  const url = new URL(`${WHOOP_BASE_URL}/${path}`);
  url.searchParams.set("start", new Date(`${startDate}T00:00:00.000Z`).toISOString());
  url.searchParams.set("end", new Date(`${endDate}T23:59:59.999Z`).toISOString());

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`WHOOP ${path} sync failed with ${response.status}.`);
  }

  const body = (await response.json()) as WhoopEnvelope<T>;
  return body.records || [];
}

function normalizeTimestamp(value?: string) {
  if (!value) return null;
  return new Date(value).toISOString();
}
