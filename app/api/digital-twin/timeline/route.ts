import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type TimelineEvent = {
  id: string;
  type: "assessment" | "biological_age" | "lab" | "protocol" | "report" | "coach" | "scenario" | "wearable" | "outcome";
  title: string;
  detail: string;
  occurred_at: string;
  signal?: string;
  href?: string;
};

type TimelineRow = Record<string, string | number | boolean | string[] | null | undefined>;

export async function GET() {
  try {
    const supabaseUser = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const [
      profileRes,
      assessmentRes,
      bioAgeRes,
      labsRes,
      protocolRes,
      reportRes,
      coachRes,
      scenarioRes,
      healthStateRes,
      wearableRes,
      outcomeRes,
    ] = await Promise.all([
      safeQuery(() =>
        admin
          .from("profiles")
          .select("display_name, plan, subscription_status, biological_age")
          .eq("user_id", user.id)
          .maybeSingle()
      ),
      safeQuery(() =>
        admin
          .from("longevity_assessments")
          .select("id, age, primary_goal, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(8)
      ),
      safeQuery(() =>
        admin
          .from("biological_age_history")
          .select("id, biological_age, chronological_age, age_delta, score, category, source, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(12)
      ),
      safeQuery(() =>
        admin
          .from("lab_biomarkers")
          .select("id, canonical_key, value, unit, measured_at")
          .eq("user_id", user.id)
          .order("measured_at", { ascending: false })
          .limit(18)
      ),
      safeQuery(() =>
        admin
          .from("optimization_protocols")
          .select("id, summary, focus_domains, status, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10)
      ),
      safeQuery(() =>
        admin
          .from("longevity_reports")
          .select("id, risk_score, primary_goal, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(8)
      ),
      safeQuery(() =>
        admin
          .from("notification_deliveries")
          .select("id, title, message, channel, status, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10)
      ),
      safeQuery(() =>
        admin
          .from("future_self_scenarios")
          .select("id, title, description, share_token, version_number, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10)
      ),
      safeQuery(() =>
        admin
          .from("health_states")
          .select("baseline, risk_scores, insights, updated_at")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ),
      safeQuery(() =>
        admin
          .from("wearable_metrics")
          .select("id, provider, metric_name, value, unit, recorded_at")
          .eq("user_id", user.id)
          .order("recorded_at", { ascending: false })
          .limit(16)
      ),
      safeQuery(() =>
        admin
          .from("intervention_outcomes")
          .select("id, domain, action, success, outcome, confidence, notes, measured_at, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(16)
      ),
    ]);

    const events = [
      ...mapAssessments(assessmentRes.data),
      ...mapBiologicalAge(bioAgeRes.data),
      ...mapLabs(labsRes.data),
      ...mapProtocols(protocolRes.data),
      ...mapReports(reportRes.data),
      ...mapCoach(coachRes.data),
      ...mapScenarios(scenarioRes.data),
      ...mapWearables(wearableRes.data),
      ...mapOutcomes(outcomeRes.data),
    ].sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at));

    return NextResponse.json({
      profile: profileRes.data || null,
      state: healthStateRes.data || null,
      timeline: events.slice(0, 60),
      counts: {
        assessments: assessmentRes.data?.length || 0,
        biologicalAgePoints: bioAgeRes.data?.length || 0,
        labs: labsRes.data?.length || 0,
        protocols: protocolRes.data?.length || 0,
        reports: reportRes.data?.length || 0,
        scenarios: scenarioRes.data?.length || 0,
        wearableMetrics: wearableRes.data?.length || 0,
        outcomes: outcomeRes.data?.length || 0,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load digital twin timeline.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function safeQuery<T>(query: () => PromiseLike<{ data: T | null; error: unknown }>) {
  const result = await query();
  if (result.error && !isMissingTableError(result.error)) {
    throw result.error instanceof Error
      ? result.error
      : new Error(JSON.stringify(result.error));
  }
  return { data: result.error ? null : result.data };
}

function mapAssessments(rows: unknown): TimelineEvent[] {
  return asRows(rows).map((row) => ({
    id: `assessment-${row.id}`,
    type: "assessment",
    title: "Longevity assessment completed",
    detail: row.primary_goal ? `Primary goal: ${text(row.primary_goal)}` : "Assessment baseline captured.",
    occurred_at: text(row.created_at),
    signal: row.age ? `${row.age} chronological` : undefined,
    href: "/assessment",
  }));
}

function mapBiologicalAge(rows: unknown): TimelineEvent[] {
  return asRows(rows).map((row) => ({
    id: `bio-${row.id}`,
    type: "biological_age",
    title: "Biological age updated",
    detail: row.category ? `${text(row.category)} category from ${text(row.source) || "assessment"} data.` : "Age engine recalculated.",
    occurred_at: text(row.created_at),
    signal: row.biological_age ? `${row.biological_age} years` : undefined,
    href: "/dashboard",
  }));
}

function mapLabs(rows: unknown): TimelineEvent[] {
  return asRows(rows).map((row) => ({
    id: `lab-${row.id}`,
    type: "lab",
    title: labelize(row.canonical_key),
    detail: "Clinical biomarker imported.",
    occurred_at: text(row.measured_at),
    signal: `${text(row.value)}${row.unit ? ` ${text(row.unit)}` : ""}`,
    href: "/dashboard",
  }));
}

function mapProtocols(rows: unknown): TimelineEvent[] {
  return asRows(rows).map((row) => ({
    id: `protocol-${row.id}`,
    type: "protocol",
    title: "Optimization protocol generated",
    detail: text(row.summary) || "Protocol saved to the optimization engine.",
    occurred_at: text(row.created_at),
    signal: Array.isArray(row.focus_domains) ? row.focus_domains.slice(0, 2).join(" / ") : text(row.status),
    href: "/optimization",
  }));
}

function mapReports(rows: unknown): TimelineEvent[] {
  return asRows(rows).map((row) => ({
    id: `report-${row.id}`,
    type: "report",
    title: "Longevity report generated",
    detail: row.primary_goal ? `Goal: ${text(row.primary_goal)}` : "Intelligence report updated.",
    occurred_at: text(row.created_at),
    signal: row.risk_score ? `${row.risk_score} risk` : undefined,
    href: "/report",
  }));
}

function mapCoach(rows: unknown): TimelineEvent[] {
  return asRows(rows).map((row) => ({
    id: `coach-${row.id}`,
    type: "coach",
    title: text(row.title) || "Coach message delivered",
    detail: text(row.message) || `${text(row.channel) || "in-app"} delivery ${text(row.status) || "sent"}.`,
    occurred_at: text(row.created_at),
    signal: text(row.channel),
    href: "/dashboard",
  }));
}

function mapScenarios(rows: unknown): TimelineEvent[] {
  return asRows(rows).map((row) => ({
    id: `scenario-${row.id}`,
    type: "scenario",
    title: text(row.title) || "Future self scenario saved",
    detail: text(row.description) || "Future self projection stored.",
    occurred_at: text(row.created_at),
    signal: row.version_number ? `v${row.version_number}` : "saved",
    href: row.share_token ? `/future-self/${row.share_token}` : "/optimization",
  }));
}

function mapWearables(rows: unknown): TimelineEvent[] {
  return asRows(rows).map((row) => ({
    id: `wearable-${row.id}`,
    type: "wearable",
    title: `${text(row.provider) || "Wearable"} ${labelize(row.metric_name)}`.toUpperCase(),
    detail: "Wearable signal ingested.",
    occurred_at: text(row.recorded_at),
    signal: `${text(row.value)}${row.unit ? ` ${text(row.unit)}` : ""}`,
    href: "/dashboard",
  }));
}

function mapOutcomes(rows: unknown): TimelineEvent[] {
  return asRows(rows).map((row) => ({
    id: `outcome-${row.id}`,
    type: "outcome",
    title: `${labelize(row.domain)} outcome tracked`,
    detail: text(row.action) || text(row.notes) || "Intervention result recorded.",
    occurred_at: text(row.measured_at) || text(row.created_at),
    signal: text(row.outcome) || (row.success ? "success" : "tracked"),
    href: "/digital-twin",
  }));
}

function asRows(value: unknown): TimelineRow[] {
  return Array.isArray(value)
    ? (value.filter((row) => row && typeof row === "object") as TimelineRow[])
    : [];
}

function text(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function labelize(value: unknown) {
  if (typeof value !== "string") return "Health signal";
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isMissingTableError(error: unknown) {
  const candidate = error as { code?: string; message?: string };
  return (
    candidate.code === "42P01" ||
    candidate.code === "PGRST205" ||
    candidate.message?.includes("schema cache")
  );
}
