import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeBiologicalAge,
  type AssessmentInput,
  type BiologicalAgeResult,
} from "@/lib/longevity/biologicalAgeEngine";
import { buildAssessmentInput } from "@/lib/longevity/assessmentInput";
import { loadLatestLabInputValues } from "@/lib/labs/latestLabInputs";

type RefreshSource = "assessment" | "wearable" | "simulation" | "system";

type HealthMetricRow = {
  metric?: string | null;
  value?: number | string | null;
  measured_at?: string | null;
};

export type BiologicalAgeRefreshResult = {
  result: BiologicalAgeResult;
  history: {
    id: string;
    chronological_age: number | string;
    biological_age: number | string;
    age_delta: number | string;
    score?: number | string | null;
    accuracy_score?: number | string | null;
    category?: string | null;
    source?: string | null;
    created_at: string;
  } | null;
};

export async function refreshBiologicalAgeForUser({
  healthProfileId,
  supabase,
  userId,
  source = "system",
}: {
  healthProfileId?: string | null;
  supabase: SupabaseClient;
  userId: string;
  source?: RefreshSource;
}): Promise<BiologicalAgeRefreshResult | null> {
  const { data: assessment, error: assessmentError } = await supabase
    .from("longevity_assessments")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (assessmentError) {
    throw new Error(assessmentError.message);
  }

  if (!assessment) return null;

  const input = await buildWearableEnhancedInput({
    healthProfileId,
    supabase,
    userId,
    assessment,
  });
  const result = computeBiologicalAge(input);

  await supabase
    .from("profiles")
    .update({
      biological_age: result.biologicalAge,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  const { data: historyPoint, error: historyError } = await supabase
    .from("biological_age_history")
    .insert({
      ...(healthProfileId ? { health_profile_id: healthProfileId } : {}),
      user_id: userId,
      assessment_id: assessment.id,
      chronological_age: result.chronologicalAge,
      biological_age: result.biologicalAge,
      age_delta: result.ageDelta,
      score: result.score,
      accuracy_score: result.accuracyScore,
      category: result.category,
      source,
      result,
    })
    .select("id, chronological_age, biological_age, age_delta, score, accuracy_score, category, source, created_at")
    .single();

  if (historyError && !isMissingHistoryTable(historyError)) {
    throw new Error(historyError.message);
  }

  return {
    result,
    history: historyPoint || null,
  };
}

async function buildWearableEnhancedInput({
  healthProfileId,
  supabase,
  userId,
  assessment,
}: {
  healthProfileId?: string | null;
  supabase: SupabaseClient;
  userId: string;
  assessment: Record<string, unknown>;
}) {
  const input = buildAssessmentInput(assessment);
  const labInput = await loadLatestLabInputValues({
    healthProfileId,
    supabase,
    userId,
  });
  const query = supabase
    .from("health_metrics")
    .select("metric, value, measured_at")
    .eq(healthProfileId ? "health_profile_id" : "user_id", healthProfileId || userId)
    .in("metric", [
      "sleep_hours",
      "resting_heart_rate",
      "heart_rate_variability",
      "vo2max",
    ])
    .order("measured_at", { ascending: false })
    .limit(80);

  const { data } = await query;

  const latest = latestMetricsByName((data || []) as HealthMetricRow[]);

  return {
    ...input,
    ...labInput,
    sleep_hours: latest.sleep_hours ?? input.sleep_hours,
    resting_hr: latest.resting_heart_rate ?? input.resting_hr,
    hrv: latest.heart_rate_variability ?? input.hrv,
    vo2_max: latest.vo2max ?? input.vo2_max,
  } satisfies AssessmentInput;
}

function latestMetricsByName(rows: HealthMetricRow[]) {
  return rows.reduce<Record<string, number>>((latest, row) => {
    const metric = row.metric || "";
    if (latest[metric] != null) return latest;

    const value = Number(row.value);
    if (metric && Number.isFinite(value)) {
      latest[metric] = value;
    }

    return latest;
  }, {});
}

function isMissingHistoryTable(error: { message?: string; code?: string }) {
  return (
    error.code === "PGRST205" ||
    error.message?.includes("biological_age_history") ||
    error.message?.includes("schema cache")
  );
}
