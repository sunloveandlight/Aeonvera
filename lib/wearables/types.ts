import type { HealthState } from "@/lib/state/healthStateEngine";
import type { BiologicalAgeRefreshResult } from "@/lib/longevity/refreshBiologicalAge";

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
  biologicalAge?: BiologicalAgeRefreshResult | null;
};
