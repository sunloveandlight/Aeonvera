import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssessmentInput } from "@/lib/longevity/biologicalAgeEngine";
import type { ClinicalBiomarkerKey } from "@/lib/labs/clinicalBiomarkers";

type LabRow = {
  canonical_key: ClinicalBiomarkerKey;
  value: number | string;
  measured_at: string;
};

const LAB_TO_INPUT_KEY: Partial<Record<ClinicalBiomarkerKey, keyof AssessmentInput>> = {
  albumin: "albumin",
  creatinine: "creatinine",
  fasting_glucose: "fasting_glucose",
  hscrp: "hscrp",
  lymphocyte_pct: "lymphocyte_pct",
  mean_cell_volume: "mean_cell_volume",
  red_cell_distribution_width: "red_cell_distribution_width",
  alkaline_phosphatase: "alkaline_phosphatase",
  white_blood_cell_count: "white_blood_cell_count",
};

export async function loadLatestLabInputValues({
  supabase,
  userId,
}: {
  supabase: SupabaseClient;
  userId: string;
}) {
  const { data, error } = await supabase
    .from("lab_biomarkers")
    .select("canonical_key, value, measured_at")
    .eq("user_id", userId)
    .order("measured_at", { ascending: false })
    .limit(80);

  if (error) {
    if (isMissingLabTable(error)) return {};
    throw new Error(error.message);
  }

  return (data || []).reduce<Partial<AssessmentInput>>((latest, row) => {
    const labRow = row as LabRow;
    const inputKey = LAB_TO_INPUT_KEY[labRow.canonical_key];
    const value = Number(labRow.value);

    if (inputKey && latest[inputKey] == null && Number.isFinite(value)) {
      latest[inputKey] = value as never;
    }

    return latest;
  }, {});
}

function isMissingLabTable(error: { message?: string; code?: string }) {
  return (
    error.code === "PGRST205" ||
    error.message?.includes("lab_biomarkers") ||
    error.message?.includes("schema cache")
  );
}
