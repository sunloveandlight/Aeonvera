import type { SupabaseClient } from "@supabase/supabase-js";
import { buildLabTrends, type LabTrend, type LabTrendRow } from "@/lib/labs/labTrends";

export async function loadLabTrendsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<LabTrend[]> {
  const { data, error } = await supabase
    .from("lab_biomarkers")
    .select("canonical_key, value, unit, measured_at")
    .eq("user_id", userId)
    .order("measured_at", { ascending: false })
    .limit(180);

  if (error) {
    if (!isMissingLabTable(error)) {
      console.error("[Lab Trends Error]", error.message);
    }

    return [];
  }

  return buildLabTrends((data || []) as LabTrendRow[]);
}

function isMissingLabTable(error: { message?: string; code?: string }) {
  return (
    error.code === "PGRST205" ||
    error.message?.includes("lab_biomarkers") ||
    error.message?.includes("schema cache")
  );
}
