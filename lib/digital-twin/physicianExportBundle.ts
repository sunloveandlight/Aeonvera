import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type PhysicianExportSection =
  | "snapshot"
  | "biological_age"
  | "labs"
  | "protocols"
  | "outcomes"
  | "wearables"
  | "clinical_insights";

export const DEFAULT_PHYSICIAN_EXPORT_SECTIONS: PhysicianExportSection[] = [
  "snapshot",
  "biological_age",
  "labs",
  "protocols",
  "outcomes",
  "wearables",
  "clinical_insights",
];

export type PhysicianExportBundle = {
  generatedAt: string;
  includedSections: PhysicianExportSection[];
  patient: {
    email?: string | null;
    profile?: Record<string, unknown> | null;
  };
  assessment?: Record<string, unknown> | null;
  latestReport?: Record<string, unknown> | null;
  biologicalAgeHistory: Record<string, unknown>[];
  labs: Record<string, unknown>[];
  protocols: Record<string, unknown>[];
  outcomes: Record<string, unknown>[];
  wearableMetrics: Record<string, unknown>[];
  clinicalInsights: Record<string, unknown>[];
  healthState?: Record<string, unknown> | null;
};

export async function buildPhysicianExportBundle({
  email,
  sections = DEFAULT_PHYSICIAN_EXPORT_SECTIONS,
  userId,
}: {
  email?: string | null;
  sections?: PhysicianExportSection[];
  userId: string;
}): Promise<PhysicianExportBundle> {
  const admin = getSupabaseAdmin();
  const includedSections = normalizeSections(sections);
  const include = new Set(includedSections);

  const [
    profile,
    assessment,
    latestReport,
    bioAgeHistory,
    labs,
    protocols,
    outcomes,
    healthState,
    wearableMetrics,
    clinicalInsights,
  ] = await Promise.all([
    safeQuery(() =>
      admin
        .from("profiles")
        .select("display_name, plan, subscription_status, biological_age, created_at")
        .eq("user_id", userId)
        .maybeSingle()
    ),
    safeQuery(() =>
      admin
        .from("longevity_assessments")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ),
    safeQuery(() =>
      admin
        .from("longevity_reports")
        .select("report, risk_score, primary_goal, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ),
    safeQuery(() =>
      admin
        .from("biological_age_history")
        .select("biological_age, chronological_age, age_delta, score, accuracy_score, category, source, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(12)
    ),
    safeQuery(() =>
      admin
        .from("lab_biomarkers")
        .select("canonical_key, value, unit, reference_range, source, measured_at")
        .eq("user_id", userId)
        .order("measured_at", { ascending: false })
        .limit(30)
    ),
    safeQuery(() =>
      admin
        .from("optimization_protocols")
        .select("protocol, summary, focus_domains, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5)
    ),
    safeQuery(() =>
      admin
        .from("intervention_outcomes")
        .select("domain,action,success,confidence,outcome,baseline_snapshot,followup_snapshot,notes,measured_at,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20)
    ),
    safeQuery(() =>
      admin
        .from("health_states")
        .select("baseline,risk_scores,insights,updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ),
    safeQuery(() =>
      admin
        .from("wearable_metrics")
        .select("provider, metric_name, metric_value, recorded_at")
        .eq("user_id", userId)
        .order("recorded_at", { ascending: false })
        .limit(20)
    ),
    safeQuery(() =>
      admin
        .from("clinical_insights")
        .select("domains, concern_status, confidence, answer_summary, range_flags, recommended_actions, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(12)
    ),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    includedSections,
    patient: {
      email: include.has("snapshot") ? email || null : null,
      profile: include.has("snapshot") ? asRecord(profile.data) : null,
    },
    assessment: include.has("snapshot") ? asRecord(assessment.data) : null,
    latestReport: include.has("snapshot") ? asRecord(latestReport.data) : null,
    biologicalAgeHistory: include.has("biological_age")
      ? asRows(bioAgeHistory.data)
      : [],
    labs: include.has("labs") ? asRows(labs.data) : [],
    protocols: include.has("protocols") ? asRows(protocols.data) : [],
    outcomes: include.has("outcomes") ? asRows(outcomes.data) : [],
    wearableMetrics: include.has("wearables") ? asRows(wearableMetrics.data) : [],
    clinicalInsights: include.has("clinical_insights")
      ? asRows(clinicalInsights.data)
      : [],
    healthState: include.has("snapshot") ? asRecord(healthState.data) : null,
  };
}

export function normalizeSections(value: unknown): PhysicianExportSection[] {
  if (!Array.isArray(value)) return DEFAULT_PHYSICIAN_EXPORT_SECTIONS;
  const allowed = new Set(DEFAULT_PHYSICIAN_EXPORT_SECTIONS);
  const sections = value.filter(
    (section): section is PhysicianExportSection =>
      typeof section === "string" && allowed.has(section as PhysicianExportSection)
  );
  return sections.length ? Array.from(new Set(sections)) : DEFAULT_PHYSICIAN_EXPORT_SECTIONS;
}

async function safeQuery<T>(query: () => PromiseLike<{ data: T | null; error: unknown }>) {
  const result = await query();

  if (result.error && !isMissingSchemaError(result.error)) {
    throw result.error instanceof Error
      ? result.error
      : new Error(JSON.stringify(result.error));
  }

  return { data: result.error ? null : result.data };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asRows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((row) => row && typeof row === "object") as Record<string, unknown>[]
    : [];
}

function isMissingSchemaError(error: unknown) {
  const candidate = error as { code?: string; message?: string };
  return (
    candidate.code === "42P01" ||
    candidate.code === "PGRST204" ||
    candidate.code === "PGRST205" ||
    candidate.message?.includes("schema cache")
  );
}
