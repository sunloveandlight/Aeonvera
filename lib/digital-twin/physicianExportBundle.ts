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
  clinicalPacket: {
    activeProtocol?: {
      detail: string;
      domains: string[];
      status?: string | null;
      title: string;
    } | null;
    executiveSummary: string;
    recentChanges: Array<{
      detail: string;
      label: string;
      tone: "positive" | "caution" | "neutral";
    }>;
    reviewPriorities: string[];
    riskFlags: Array<{
      detail: string;
      label: string;
      severity: "high" | "medium" | "watch";
    }>;
  };
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

  const bundleSections = {
    assessment: include.has("snapshot") ? asRecord(assessment.data) : null,
    biologicalAgeHistory: include.has("biological_age")
      ? asRows(bioAgeHistory.data)
      : [],
    clinicalInsights: include.has("clinical_insights")
      ? asRows(clinicalInsights.data)
      : [],
    healthState: include.has("snapshot") ? asRecord(healthState.data) : null,
    labs: include.has("labs") ? asRows(labs.data) : [],
    latestReport: include.has("snapshot") ? asRecord(latestReport.data) : null,
    outcomes: include.has("outcomes") ? asRows(outcomes.data) : [],
    protocols: include.has("protocols") ? asRows(protocols.data) : [],
    wearableMetrics: include.has("wearables") ? asRows(wearableMetrics.data) : [],
  };

  return {
    clinicalPacket: buildClinicalPacket(bundleSections),
    generatedAt: new Date().toISOString(),
    includedSections,
    patient: {
      email: include.has("snapshot") ? email || null : null,
      profile: include.has("snapshot") ? asRecord(profile.data) : null,
    },
    ...bundleSections,
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

function buildClinicalPacket({
  biologicalAgeHistory,
  clinicalInsights,
  healthState,
  labs,
  latestReport,
  outcomes,
  protocols,
  wearableMetrics,
}: {
  biologicalAgeHistory: Record<string, unknown>[];
  clinicalInsights: Record<string, unknown>[];
  healthState: Record<string, unknown> | null;
  labs: Record<string, unknown>[];
  latestReport: Record<string, unknown> | null;
  outcomes: Record<string, unknown>[];
  protocols: Record<string, unknown>[];
  wearableMetrics: Record<string, unknown>[];
}): PhysicianExportBundle["clinicalPacket"] {
  const latestBio = numberOrNull(biologicalAgeHistory[0]?.biological_age);
  const priorBio = numberOrNull(biologicalAgeHistory[1]?.biological_age);
  const riskScore = numberOrNull(latestReport?.risk_score);
  const topRisks = Object.entries(asNumberRecord(healthState?.risk_scores))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const activeProtocol = protocols[0];
  const riskFlags = buildRiskFlags({
    clinicalInsights,
    labs,
    riskScore,
    topRisks,
  });
  const recentChanges = buildRecentChanges({
    latestBio,
    outcomes,
    priorBio,
    wearableMetrics,
  });
  const report = asRecord(latestReport?.report);
  const reviewPriorities = [
    ...stringArray(report?.top_priorities),
    ...clinicalInsights
      .flatMap((insight) => {
        const actions = Array.isArray(insight.recommended_actions)
          ? insight.recommended_actions
          : [];
        return actions.map((action) =>
          typeof action === "string" ? action : text(asRecord(action)?.action)
        );
      })
      .filter(Boolean),
    ...riskFlags.map((flag) => `Review ${flag.label.toLowerCase()}: ${flag.detail}`),
  ].slice(0, 5);

  return {
    activeProtocol: activeProtocol
      ? {
          detail: text(activeProtocol.summary) || "Active optimization protocol is available for review.",
          domains: stringArray(activeProtocol.focus_domains).slice(0, 4),
          status: text(activeProtocol.status) || null,
          title:
            stringArray(activeProtocol.focus_domains).slice(0, 3).join(" / ") ||
            "Optimization protocol",
        }
      : null,
    executiveSummary: buildExecutiveSummary({
      latestBio,
      recentChanges,
      riskFlags,
      riskScore,
      topRisks,
    }),
    recentChanges,
    reviewPriorities: reviewPriorities.length
      ? Array.from(new Set(reviewPriorities)).slice(0, 5)
      : ["Review current biological age, biomarkers, protocols, and tracked outcomes in context."],
    riskFlags,
  };
}

function buildRiskFlags({
  clinicalInsights,
  labs,
  riskScore,
  topRisks,
}: {
  clinicalInsights: Record<string, unknown>[];
  labs: Record<string, unknown>[];
  riskScore: number | null;
  topRisks: Array<[string, number]>;
}) {
  const flags: PhysicianExportBundle["clinicalPacket"]["riskFlags"] = [];

  if (riskScore != null && riskScore >= 60) {
    flags.push({
      detail: `Latest longevity report risk score is ${Math.round(riskScore)}.`,
      label: "Elevated global risk",
      severity: riskScore >= 75 ? "high" : "medium",
    });
  }

  topRisks
    .filter(([, value]) => value >= 55)
    .forEach(([key, value]) => {
      flags.push({
        detail: `${labelize(key)} risk score is ${Math.round(value)}%.`,
        label: labelize(key),
        severity: value >= 75 ? "high" : "medium",
      });
    });

  clinicalInsights
    .filter((insight) => ["active", "unresolved", "monitoring"].includes(text(insight.concern_status)))
    .slice(0, 2)
    .forEach((insight) => {
      flags.push({
        detail: text(insight.answer_summary) || "Clinical intelligence thread remains active.",
        label: stringArray(insight.domains).join(" / ") || "Clinical thread",
        severity: text(insight.concern_status) === "unresolved" ? "high" : "watch",
      });
    });

  const staleLabs = latestDate(labs.map((lab) => text(lab.measured_at)));
  if (staleLabs && daysSince(staleLabs) > 180) {
    flags.push({
      detail: `Most recent included lab signal is ${daysSince(staleLabs)} days old.`,
      label: "Lab freshness",
      severity: "watch",
    });
  }

  return flags.slice(0, 5);
}

function buildRecentChanges({
  latestBio,
  outcomes,
  priorBio,
  wearableMetrics,
}: {
  latestBio: number | null;
  outcomes: Record<string, unknown>[];
  priorBio: number | null;
  wearableMetrics: Record<string, unknown>[];
}) {
  const changes: PhysicianExportBundle["clinicalPacket"]["recentChanges"] = [];

  if (latestBio != null && priorBio != null) {
    const delta = round(latestBio - priorBio, 1);
    changes.push({
      detail:
        delta < 0
          ? `Biological age improved by ${Math.abs(delta).toFixed(1)} years versus the prior point.`
          : delta > 0
            ? `Biological age increased by ${delta.toFixed(1)} years versus the prior point.`
            : "Biological age is stable versus the prior point.",
      label: "Biological age",
      tone: delta < 0 ? "positive" : delta > 0 ? "caution" : "neutral",
    });
  }

  const recentOutcome = outcomes[0];
  if (recentOutcome) {
    const outcome = text(recentOutcome.outcome) || (recentOutcome.success === true ? "success" : "tracked");
    changes.push({
      detail: `${text(recentOutcome.action) || "Intervention"} was logged as ${outcome}.`,
      label: "Latest outcome",
      tone: outcome === "success" ? "positive" : outcome === "failure" ? "caution" : "neutral",
    });
  }

  const wearableDate = latestDate(wearableMetrics.map((metric) => text(metric.recorded_at)));
  if (wearableDate) {
    const age = daysSince(wearableDate);
    changes.push({
      detail: age <= 7
        ? "Wearable data is current enough to support recovery context."
        : `Latest wearable signal is ${age} days old.`,
      label: "Wearable freshness",
      tone: age <= 7 ? "positive" : age > 30 ? "caution" : "neutral",
    });
  }

  return changes.slice(0, 4);
}

function buildExecutiveSummary({
  latestBio,
  recentChanges,
  riskFlags,
  riskScore,
  topRisks,
}: {
  latestBio: number | null;
  recentChanges: PhysicianExportBundle["clinicalPacket"]["recentChanges"];
  riskFlags: PhysicianExportBundle["clinicalPacket"]["riskFlags"];
  riskScore: number | null;
  topRisks: Array<[string, number]>;
}) {
  const leadingRisk = riskFlags[0]?.label || (topRisks[0] ? labelize(topRisks[0][0]) : "");
  const bioText = latestBio != null ? ` Current biological age is ${latestBio}.` : "";
  const riskText = riskScore != null ? ` Latest report risk score is ${Math.round(riskScore)}.` : "";
  const changeText = recentChanges[0]?.detail ? ` ${recentChanges[0].detail}` : "";
  const priorityText = leadingRisk
    ? ` Primary review focus: ${leadingRisk.toLowerCase()}.`
    : " Primary review focus: establish sufficient longitudinal signal.";

  return `Aeonvera prepared this as a read-only longitudinal healthspan packet for clinical review.${bioText}${riskText}${changeText}${priorityText}`;
}

function asNumberRecord(value: unknown) {
  const record = asRecord(value) || {};
  return Object.fromEntries(
    Object.entries(record)
      .map(([key, score]) => [key, Number(score)] as const)
      .filter(([, score]) => Number.isFinite(score))
  );
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function text(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function numberOrNull(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function labelize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function latestDate(values: string[]) {
  const latest = values
    .map((value) => {
      const time = Date.parse(value);
      return Number.isFinite(time) ? time : null;
    })
    .filter((value): value is number => value != null)
    .sort((a, b) => b - a)[0];

  return latest ? new Date(latest).toISOString() : "";
}

function daysSince(value: string) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, Math.floor((Date.now() - time) / (24 * 60 * 60 * 1000)));
}

function round(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
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
