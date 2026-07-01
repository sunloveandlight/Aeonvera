import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssessmentInput } from "@/lib/longevity/biologicalAgeEngine";
import type { ClinicalBiomarkerKey } from "@/lib/labs/clinicalBiomarkers";

type LabRow = {
  canonical_key: ClinicalBiomarkerKey;
  unit?: string | null;
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
  healthProfileId,
  supabase,
  userId,
}: {
  healthProfileId?: string | null;
  supabase: SupabaseClient;
  userId: string;
}) {
  const query = supabase
    .from("lab_biomarkers")
    .select("canonical_key, value, unit, measured_at")
    .eq(healthProfileId ? "health_profile_id" : "user_id", healthProfileId || userId)
    .order("measured_at", { ascending: false })
    .limit(80);

  const { data, error } = await query;

  if (error) {
    if (isMissingLabTable(error)) return {};
    throw new Error(error.message);
  }

  return (data || []).reduce<Partial<AssessmentInput>>((latest, row) => {
    const labRow = row as LabRow;
    const inputKey = LAB_TO_INPUT_KEY[labRow.canonical_key];
    const value = normalizeBiologicalAgeInputValue(
      labRow.canonical_key,
      Number(labRow.value)
    );

    if (inputKey && latest[inputKey] == null && Number.isFinite(value)) {
      latest[inputKey] = value as never;
    }

    return latest;
  }, {});
}

export function normalizeBiologicalAgeInputValue(
  key: ClinicalBiomarkerKey,
  value: number
) {
  if (!Number.isFinite(value)) return value;

  switch (key) {
    case "fasting_glucose":
      // Imported labs are stored in mmol/L; the age engine scores mg/dL.
      return value * 18;
    case "hscrp":
      // Imported hsCRP is stored in mg/dL; the age engine scores mg/L.
      return value * 10;
    default:
      return value;
  }
}

function isMissingLabTable(error: { message?: string; code?: string }) {
  return (
    error.code === "PGRST205" ||
    error.message?.includes("lab_biomarkers") ||
    error.message?.includes("schema cache")
  );
}
