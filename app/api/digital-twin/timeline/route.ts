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

type TwinChange = {
  metric: string;
  direction: "improving" | "declining" | "stable" | "new";
  detail: string;
  signal: string;
};

type TwinIntelligence = {
  summary: string;
  modelState: string;
  confidence: number;
  changes: TwinChange[];
  worked: TwinChange[];
  nextMove: {
    title: string;
    detail: string;
    href: string;
  };
};

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
      healthMetricRes,
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
          .select("id, provider, metric_name, metric_value, recorded_at")
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
      safeQuery(() =>
        admin
          .from("health_metrics")
          .select("metric, value, measured_at, source")
          .eq("user_id", user.id)
          .order("measured_at", { ascending: false })
          .limit(80)
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
      intelligence: buildTwinIntelligence({
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
        state: healthStateRes.data,
        bioAgeRows: bioAgeRes.data,
        healthMetricRows: healthMetricRes.data,
        outcomeRows: outcomeRes.data,
        labRows: labsRes.data,
      }),
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

function buildTwinIntelligence({
  counts,
  state,
  bioAgeRows,
  healthMetricRows,
  outcomeRows,
  labRows,
}: {
  counts: Record<string, number>;
  state: unknown;
  bioAgeRows: unknown;
  healthMetricRows: unknown;
  outcomeRows: unknown;
  labRows: unknown;
}): TwinIntelligence {
  const healthMetrics = asRows(healthMetricRows);
  const outcomes = asRows(outcomeRows);
  const bioAge = asRows(bioAgeRows);
  const labs = asRows(labRows);
  const changes = buildMetricChanges(healthMetrics);
  const worked = buildWhatWorked(outcomes, bioAge);
  const riskScores = readRiskScores(state);
  const modelState = buildModelState(counts);
  const topRisk = Object.entries(riskScores).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
  const latestBio = bioAge[0];
  const priorBio = bioAge[1];
  const bioDelta =
    numberOrNull(latestBio?.biological_age) != null && numberOrNull(priorBio?.biological_age) != null
      ? round(Number(latestBio?.biological_age) - Number(priorBio?.biological_age), 1)
      : null;
  const bestChange = changes.find((change) => change.direction === "improving");
  const concerningChange = changes.find((change) => change.direction === "declining");
  const latestOutcome = outcomes[0];

  const summary =
    bioDelta != null && bioDelta < 0
      ? `Your Digital Twin is moving in the right direction: biological age is down ${Math.abs(bioDelta).toFixed(1)} years from the prior point.`
      : bioDelta != null && bioDelta > 0
      ? `Your Digital Twin is flagging pressure: biological age is up ${bioDelta.toFixed(1)} years from the prior point.`
      : bestChange
      ? `${bestChange.metric} is currently the strongest improving signal in your model.`
      : concerningChange
      ? `${concerningChange.metric} is the signal your model is watching most closely.`
      : "Your Digital Twin is building its baseline from assessments, labs, outcomes, protocols, and wearable signals.";

  const nextMove =
    concerningChange
      ? {
          title: `Stabilize ${concerningChange.metric}`,
          detail: `The next protocol should target this signal because ${concerningChange.detail.toLowerCase()}`,
          href: "/optimization",
        }
      : topRisk
      ? {
          title: `Reduce ${labelize(topRisk[0])} load`,
          detail: `This is currently the highest risk domain in your model at ${Math.round(Number(topRisk[1]))}%.`,
          href: "/optimization",
        }
      : labs.length < 2
      ? {
          title: "Add another clinical layer",
          detail: "A second lab import will let Aeonvera compare biomarker direction instead of only baseline status.",
          href: "/dashboard",
        }
      : {
          title: "Run the next optimization protocol",
          detail: latestOutcome
            ? `Last tracked result: ${text(latestOutcome.action) || labelize(latestOutcome.domain)}. Use that feedback to sharpen the next protocol.`
            : "The model is ready for a tracked intervention so it can learn what actually changes your healthspan.",
          href: "/optimization",
        };

  return {
    summary,
    modelState,
    confidence: buildConfidence(counts),
    changes: changes.slice(0, 4),
    worked: worked.slice(0, 3),
    nextMove,
  };
}

function buildMetricChanges(rows: TimelineRow[]): TwinChange[] {
  const groups = new Map<string, TimelineRow[]>();

  rows.forEach((row) => {
    const metric = text(row.metric);
    if (!metric) return;
    const current = groups.get(metric) || [];
    current.push(row);
    groups.set(metric, current);
  });

  return Array.from(groups.entries())
    .map(([metric, values]) => {
      const sorted = values
        .slice()
        .sort((a, b) => Date.parse(text(b.measured_at)) - Date.parse(text(a.measured_at)))
        .map((row) => Number(row.value))
        .filter(Number.isFinite);

      if (sorted.length < 2) {
        return {
          metric: labelize(metric),
          direction: "new" as const,
          detail: "A new signal has entered the model.",
          signal: sorted[0] != null ? formatNumber(sorted[0]) : "new",
        };
      }

      const recent = average(sorted.slice(0, Math.min(3, sorted.length)));
      const prior = average(sorted.slice(Math.min(3, sorted.length), Math.min(8, sorted.length)));
      const delta = recent - prior;
      const direction = classifyMetricDirection(metric, delta);

      return {
        metric: labelize(metric),
        direction,
        detail: `${direction === "stable" ? "Holding steady" : direction === "improving" ? "Improving" : "Moving away from target"} by ${formatNumber(Math.abs(delta))}.`,
        signal: `${formatNumber(recent)} latest avg`,
      };
    })
    .sort((a, b) => directionRank(a.direction) - directionRank(b.direction));
}

function buildWhatWorked(outcomes: TimelineRow[], bioAge: TimelineRow[]): TwinChange[] {
  const successful = outcomes.filter((row) => text(row.outcome) === "success" || row.success === true);
  const items = successful.map((row) => ({
    metric: labelize(row.domain) || "Protocol",
    direction: "improving" as const,
    detail: text(row.action) || text(row.notes) || "Tracked intervention improved.",
    signal: "worked",
  }));
  const latest = numberOrNull(bioAge[0]?.biological_age);
  const prior = numberOrNull(bioAge[1]?.biological_age);

  if (latest != null && prior != null && latest < prior) {
    items.unshift({
      metric: "Biological Age",
      direction: "improving",
      detail: `Down ${Math.abs(round(latest - prior, 1)).toFixed(1)} years from the previous point.`,
      signal: "improved",
    });
  }

  if (items.length) return items;

  return [
    {
      metric: "Learning Loop",
      direction: "new",
      detail: "Track one intervention outcome to let Aeonvera identify what works for you.",
      signal: "ready",
    },
  ];
}

function buildModelState(counts: Record<string, number>) {
  const activeInputs = [
    counts.assessments,
    counts.biologicalAgePoints,
    counts.labs,
    counts.protocols,
    counts.outcomes,
    counts.wearableMetrics,
  ].filter((value) => value > 0).length;

  if (activeInputs >= 5) return "Integrated";
  if (activeInputs >= 3) return "Learning";
  if (activeInputs >= 1) return "Baseline";
  return "Waiting for data";
}

function buildConfidence(counts: Record<string, number>) {
  const score =
    20 +
    Math.min(20, counts.assessments * 10) +
    Math.min(20, counts.biologicalAgePoints * 5) +
    Math.min(20, counts.labs * 3) +
    Math.min(10, counts.outcomes * 5) +
    Math.min(10, counts.wearableMetrics);

  return Math.min(96, score);
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
    signal: text(row.metric_value),
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

function readRiskScores(value: unknown): Record<string, number> {
  const candidate = value as { risk_scores?: Record<string, unknown> } | null;
  if (!candidate?.risk_scores || typeof candidate.risk_scores !== "object") return {};

  return Object.fromEntries(
    Object.entries(candidate.risk_scores)
      .map(([key, score]) => [key, Number(score)] as const)
      .filter(([, score]) => Number.isFinite(score))
  );
}

function classifyMetricDirection(metric: string, delta: number): TwinChange["direction"] {
  if (Math.abs(delta) < 0.2) return "stable";

  const lowerIsBetter = [
    "resting_heart_rate",
    "stress",
    "body_fat_percentage",
    "fasting_glucose",
  ];

  if (lowerIsBetter.includes(metric)) return delta < 0 ? "improving" : "declining";
  return delta > 0 ? "improving" : "declining";
}

function directionRank(direction: TwinChange["direction"]) {
  if (direction === "declining") return 0;
  if (direction === "improving") return 1;
  if (direction === "new") return 2;
  return 3;
}

function average(values: number[]) {
  const finite = values.filter(Number.isFinite);
  return finite.length
    ? finite.reduce((sum, value) => sum + value, 0) / finite.length
    : 0;
}

function numberOrNull(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function round(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatNumber(value: number) {
  return Math.abs(value) >= 10 ? `${Math.round(value)}` : value.toFixed(1);
}

function isMissingTableError(error: unknown) {
  const candidate = error as { code?: string; message?: string };
  return (
    candidate.code === "42P01" ||
    candidate.code === "PGRST205" ||
    candidate.message?.includes("schema cache")
  );
}
