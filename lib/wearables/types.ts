import type { HealthState } from "@/lib/state/healthStateEngine";

export type WearableProvider = "oura" | "apple" | "whoop";

export type WearableRawMetric = {
  metricName: string;
  value: number;
  timestamp: string;
};

export type WearableIngestionResult = {
  inserted: number;
  normalized: number;
  stateUpdated: boolean;
  state?: HealthState;
};
