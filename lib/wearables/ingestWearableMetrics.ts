import { buildHealthState } from "@/lib/state/healthStateEngine";
import { normalizeHealthMetrics } from "@/lib/metrics/normalizeHealthMetrics";
import { refreshBiologicalAgeForUser } from "@/lib/longevity/refreshBiologicalAge";
import { healthSubjectInsertFields, type ActiveHealthProfileContext } from "@/lib/health-profiles/activeHealthProfile";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WearableProvider, WearableRawMetric, WearableIngestionResult } from "./types";

export async function ingestWearableMetrics({
  supabase,
  userId,
  provider,
  metrics,
  healthProfileContext,
}: {
  healthProfileContext?: ActiveHealthProfileContext | null;
  supabase: SupabaseClient;
  userId: string;
  provider: WearableProvider;
  metrics: WearableRawMetric[];
}): Promise<WearableIngestionResult> {
  const healthProfileId = healthProfileContext?.healthProfileId || null;
  const subjectFields = healthProfileContext
    ? healthSubjectInsertFields(healthProfileContext)
    : { health_profile_id: null };
  const subjectColumn = healthProfileId ? "health_profile_id" : "user_id";
  const subjectValue = healthProfileId || userId;
  const validMetrics = metrics.filter(
    (metric) =>
      metric.metricName &&
      Number.isFinite(metric.value) &&
      Boolean(metric.timestamp)
  );

  if (validMetrics.length === 0) {
    return { inserted: 0, normalized: 0, stateUpdated: false };
  }

  const rawRows = validMetrics.map((metric) => ({
    user_id: userId,
    ...subjectFields,
    provider,
    metric_name: metric.metricName,
    metric_value: metric.value,
    recorded_at: metric.timestamp,
  }));

  const { error: rawError } = await supabase.from("wearable_metrics").insert(rawRows);

  if (rawError) {
    throw new Error(rawError.message);
  }

  const normalized = normalizeHealthMetrics(
    validMetrics.map((metric) => ({
      userId,
      source: provider,
      metricName: metric.metricName,
      value: metric.value,
      timestamp: metric.timestamp,
    }))
  );

  if (normalized.length > 0) {
    const { error: normalizedError } = await supabase.from("health_metrics").upsert(
      normalized.map((metric) => ({
        user_id: metric.userId,
        ...subjectFields,
        metric: metric.metric,
        value: metric.value,
        measured_at: metric.measured_at,
        source: metric.source,
      }))
    );

    if (normalizedError) {
      throw new Error(normalizedError.message);
    }
  }

  const { data: canonicalMetrics, error: canonicalError } = await supabase
    .from("health_metrics")
    .select("*")
    .eq(subjectColumn, subjectValue)
    .order("measured_at", { ascending: true });

  if (canonicalError) {
    throw new Error(canonicalError.message);
  }

  const state = buildHealthState(
    (canonicalMetrics || []).map((metric) => ({
      userId: String(metric.user_id),
      metricName: String(metric.metric),
      value: Number(metric.value),
      timestamp: String(metric.measured_at),
    }))
  );

  if (!state) {
    return {
      inserted: validMetrics.length,
      normalized: normalized.length,
      stateUpdated: false,
    };
  }

  const latestTimestamp = validMetrics
    .map((metric) => metric.timestamp)
    .reduce((max, current) =>
      new Date(current) > new Date(max) ? current : max
    );

  const statePayload = {
    user_id: userId,
    ...subjectFields,
    baseline: state.baseline,
    trends: state.trends,
    risk_scores: state.riskScores,
    insights: state.insights,
    updated_at: state.updatedAt,
    last_processed_at: latestTimestamp,
  };

  const stateError = healthProfileId
    ? await updateOrInsertByHealthProfile(supabase, "health_states", healthProfileId, statePayload)
    : (
        await supabase
          .from("health_states")
          .upsert(statePayload, { onConflict: "user_id" })
      ).error;

  if (stateError) {
    throw new Error(stateError.message);
  }

  await supabase.from("health_alerts").insert({
    user_id: userId,
    ...subjectFields,
    type: "wearable_sync",
    severity: "low",
    title: "Wearable data synced",
    message: `${provider} sent ${validMetrics.length} new metrics into Aeonvera.`,
    recommendation: "Your health state has been rebuilt from the latest wearable data.",
    confidence: 0.78,
  });

  const biologicalAge = await refreshBiologicalAgeForUser({
    supabase,
    userId,
    healthProfileId,
    source: "wearable",
  });

  return {
    inserted: validMetrics.length,
    normalized: normalized.length,
    stateUpdated: true,
    state,
    biologicalAge,
  };
}

async function updateOrInsertByHealthProfile(
  supabase: SupabaseClient,
  table: string,
  healthProfileId: string,
  payload: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from(table)
    .update(payload)
    .eq("health_profile_id", healthProfileId)
    .select("id")
    .limit(1);

  if (error) return error;
  if (Array.isArray(data) && data.length > 0) return null;

  return (await supabase.from(table).insert(payload)).error;
}
