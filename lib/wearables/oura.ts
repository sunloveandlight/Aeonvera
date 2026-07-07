import type { WearableRawMetric } from "./types";

type OuraEnvelope<T> = { data?: T[]; next_token?: string | null };
type OuraDailySleep = {
  day?: string;
  score?: number;
  contributors?: { sleep_efficiency?: number };
};
type OuraSleep = {
  day?: string;
  type?: string | null;
  total_sleep_duration?: number;
  efficiency?: number;
};
type OuraReadiness = {
  day?: string;
  score?: number;
};
type OuraActivity = {
  day?: string;
  score?: number;
  steps?: number;
};

const OURA_BASE_URL = "https://api.ouraring.com/v2/usercollection";

export async function fetchOuraMetrics({
  accessToken,
  startDate,
  endDate,
}: {
  accessToken: string;
  startDate: string;
  endDate: string;
}): Promise<WearableRawMetric[]> {
  const [dailySleep, sleep, readiness, activity] = await Promise.all([
    fetchOura<OuraDailySleep>("daily_sleep", accessToken, startDate, endDate),
    fetchOura<OuraSleep>("sleep", accessToken, startDate, endDate),
    fetchOura<OuraReadiness>("daily_readiness", accessToken, startDate, endDate),
    fetchOura<OuraActivity>("daily_activity", accessToken, startDate, endDate),
  ]);

  return dedupeMetrics([
    ...sleep.flatMap((entry) => {
      if (entry.type !== "long_sleep") return [];
      const timestamp = dayToTimestamp(entry.day);
      const metrics: WearableRawMetric[] = [];

      if (timestamp && Number.isFinite(entry.total_sleep_duration)) {
        metrics.push({
          metricName: "sleep_duration",
          value: Number(entry.total_sleep_duration) / 3600,
          timestamp,
        });
      }

      if (timestamp && Number.isFinite(entry.efficiency)) {
        metrics.push({
          metricName: "sleep_efficiency",
          value: Number(entry.efficiency),
          timestamp,
        });
      }

      return metrics;
    }),
    ...dailySleep.flatMap((entry) => {
      const timestamp = dayToTimestamp(entry.day);
      if (!timestamp || !Number.isFinite(entry.contributors?.sleep_efficiency)) return [];
      return [{
        metricName: "sleep_efficiency",
        value: Number(entry.contributors?.sleep_efficiency),
        timestamp,
      }];
    }),
    ...readiness.flatMap((entry) => {
      const timestamp = dayToTimestamp(entry.day);
      if (!timestamp || !Number.isFinite(entry.score)) return [];
      return [{ metricName: "readiness", value: Number(entry.score), timestamp }];
    }),
    ...activity.flatMap((entry) => {
      const timestamp = dayToTimestamp(entry.day);
      if (!timestamp) return [];

      return [
        Number.isFinite(entry.score)
          ? { metricName: "activity_score", value: Number(entry.score), timestamp }
          : null,
        Number.isFinite(entry.steps)
          ? { metricName: "steps", value: Number(entry.steps), timestamp }
          : null,
      ].filter(Boolean) as WearableRawMetric[];
    }),
  ]);
}

async function fetchOura<T>(
  path: string,
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<T[]> {
  const rows: T[] = [];
  let nextToken: string | null = null;

  for (let page = 0; page < 20; page += 1) {
    const url = new URL(`${OURA_BASE_URL}/${path}`);
    url.searchParams.set("start_date", startDate);
    url.searchParams.set("end_date", endDate);
    if (nextToken) url.searchParams.set("next_token", nextToken);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Oura ${path} sync failed with ${response.status}.`);
    }

    const body = (await response.json()) as OuraEnvelope<T>;
    rows.push(...(body.data || []));
    nextToken = body.next_token || null;
    if (!nextToken) break;
  }

  return rows;
}

function dayToTimestamp(day?: string) {
  if (!day) return null;
  return new Date(`${day}T12:00:00.000Z`).toISOString();
}

function dedupeMetrics(metrics: WearableRawMetric[]) {
  const seen = new Set<string>();
  return metrics.filter((metric) => {
    const key = `${metric.metricName}:${metric.timestamp}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
