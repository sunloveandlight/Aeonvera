import type { WearableRawMetric } from "./types";

type AppleRecord = {
  type?: string;
  metricName?: string;
  value?: string | number;
  startDate?: string;
  endDate?: string;
  timestamp?: string;
};

const APPLE_METRIC_MAP: Record<string, string> = {
  HKQuantityTypeIdentifierStepCount: "step_count",
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN: "heart_rate_variability",
  HKQuantityTypeIdentifierRestingHeartRate: "resting_heart_rate",
  HKQuantityTypeIdentifierVO2Max: "vo2max",
  HKCategoryTypeIdentifierSleepAnalysis: "sleep_hours",
  step_count: "step_count",
  heart_rate_variability: "heart_rate_variability",
  resting_heart_rate: "resting_heart_rate",
  sleep_hours: "sleep_hours",
  vo2max: "vo2max",
};

export function parseAppleHealthPayload(input: unknown): WearableRawMetric[] {
  const records = Array.isArray(input)
    ? input
    : Array.isArray((input as { records?: unknown[] })?.records)
    ? (input as { records: unknown[] }).records
    : Array.isArray((input as { metrics?: unknown[] })?.metrics)
    ? (input as { metrics: unknown[] }).metrics
    : [];

  return records.flatMap((record) => normalizeAppleRecord(record as AppleRecord));
}

export function parseAppleHealthText(input: string): WearableRawMetric[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  try {
    return parseAppleHealthPayload(JSON.parse(trimmed));
  } catch {
    return parseDelimitedAppleHealthText(trimmed);
  }
}

function parseDelimitedAppleHealthText(input: string): WearableRawMetric[] {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = splitDelimitedLine(lines[0]).map((header) =>
    header.toLowerCase().replace(/[^a-z0-9]/g, "")
  );

  const typeIndex = firstIndex(headers, ["type", "metric", "metricname", "name"]);
  const valueIndex = firstIndex(headers, ["value", "amount"]);
  const timestampIndex = firstIndex(headers, [
    "timestamp",
    "date",
    "recordedat",
    "enddate",
    "startdate",
  ]);

  if (typeIndex < 0 || valueIndex < 0 || timestampIndex < 0) return [];

  return lines.slice(1).flatMap((line) => {
    const cells = splitDelimitedLine(line);

    return normalizeAppleRecord({
      type: cells[typeIndex],
      value: cells[valueIndex],
      timestamp: cells[timestampIndex],
    });
  });
}

function splitDelimitedLine(line: string) {
  const delimiter = line.includes("\t") ? "\t" : ",";

  return line
    .split(delimiter)
    .map((cell) => cell.trim().replace(/^"|"$/g, ""));
}

function firstIndex(headers: string[], candidates: string[]) {
  return headers.findIndex((header) => candidates.includes(header));
}

function normalizeAppleRecord(record: AppleRecord): WearableRawMetric[] {
  const type = record.metricName || record.type || "";
  const metricName = APPLE_METRIC_MAP[type];
  const timestamp = record.timestamp || record.endDate || record.startDate;
  const value = Number(record.value);

  if (!metricName || !timestamp || !Number.isFinite(value)) return [];

  if (metricName === "sleep_hours" && record.startDate && record.endDate) {
    const hours =
      (new Date(record.endDate).getTime() - new Date(record.startDate).getTime()) /
      36e5;

    if (Number.isFinite(hours) && hours > 0) {
      return [{ metricName, value: hours, timestamp }];
    }
  }

  return [{ metricName, value, timestamp }];
}
