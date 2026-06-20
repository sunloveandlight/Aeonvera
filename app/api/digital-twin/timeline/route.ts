import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccess, type Plan, type SubscriptionStatus } from "@/lib/auth/permissions";
import {
  getHealthSubjectFilter,
  getRequestedHealthProfileId,
  resolveActiveHealthProfileContext,
} from "@/lib/health-profiles/activeHealthProfile";

type TimelineEvent = {
  id: string;
  type: "assessment" | "biological_age" | "lab" | "protocol" | "report" | "coach" | "scenario" | "wearable" | "outcome";
  title: string;
  detail: string;
  occurred_at: string;
  signal?: string;
  href?: string;
};

type TimelineRow = Record<string, unknown>;

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

type TwinDomain = {
  detail: string;
  evidence: number;
  label: string;
  score: number;
  status: "strong" | "learning" | "thin";
};

type TwinScenarioPrompt = {
  detail: string;
  href: string;
  question: string;
  scenarioIds: string[];
};

type TwinProjectionComparison = {
  actual?: string;
  actions?: string[];
  adjustment: {
    detail: string;
    title: string;
  };
  confidence: number;
  detail: string;
  evidenceMissing: string[];
  followUpQuestion: string;
  linkedProtocol?: string;
  projected?: string;
  status: "pending" | "tracking" | "on_track" | "off_track";
  title: string;
};

type TwinModel = {
  domains: TwinDomain[];
  projectionComparisons: TwinProjectionComparison[];
  readiness: {
    detail: string;
    score: number;
    status: string;
  };
  scenarioPrompts: TwinScenarioPrompt[];
};

type TwinAudit = {
  blindSpots: Array<{
    actionHref: string;
    detail: string;
    label: string;
  }>;
  evidencePriorities: string[];
  freshness: {
    detail: string;
    label: string;
    status: "current" | "warming" | "stale";
    updatedAt?: string;
  };
  recommendationReason: string;
};

export async function GET(request: NextRequest) {
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
    const { data: entitlementProfile } = await admin
      .from("profiles")
      .select("plan,subscription_status")
      .eq("user_id", user.id)
      .maybeSingle();
    const entitlement = entitlementProfile as {
      plan?: Plan | null;
      subscription_status?: SubscriptionStatus | null;
    } | null;

    if (
      !canAccess(
        entitlement?.plan || null,
        entitlement?.subscription_status || null,
        "digital_twin"
      )
    ) {
      return NextResponse.json(
        {
          locked: true,
          upgrade: {
            minimumPlan: "sovereign",
            message:
              "Digital Twin timeline and modeling are included in Sovereign.",
          },
          intelligence: {
            summary:
              "Sovereign unlocks the full living timeline across biomarkers, protocols, scenarios, wearables, outcomes, and clinical memory.",
            modelState: "Locked",
            confidence: 0,
            changes: [],
            worked: [],
            nextMove: {
              title: "Upgrade to Sovereign",
              detail:
                "Open the full executive digital twin with physician-ready context and longitudinal intelligence.",
              href: "/pricing",
            },
          },
          counts: {},
          timeline: [],
        },
        { status: 403 }
      );
    }

    const healthProfileContext = await resolveActiveHealthProfileContext({
      supabase: admin,
      loginUserId: user.id,
      requestedHealthProfileId: getRequestedHealthProfileId(request),
    });
    const healthSubjectFilter = getHealthSubjectFilter(healthProfileContext);

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
      clinicalInsightRes,
      preferenceRes,
      dailyPlanRes,
      calendarRes,
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
          .eq(healthSubjectFilter.column, healthSubjectFilter.value)
          .order("created_at", { ascending: false })
          .limit(8)
      ),
      safeQuery(() =>
        admin
          .from("biological_age_history")
          .select("id, biological_age, chronological_age, age_delta, score, category, source, created_at")
          .eq(healthSubjectFilter.column, healthSubjectFilter.value)
          .order("created_at", { ascending: false })
          .limit(12)
      ),
      safeQuery(() =>
        admin
          .from("lab_biomarkers")
          .select("id, canonical_key, value, unit, measured_at")
          .eq(healthSubjectFilter.column, healthSubjectFilter.value)
          .order("measured_at", { ascending: false })
          .limit(18)
      ),
      safeQuery(() =>
        admin
          .from("optimization_protocols")
          .select("id, protocol, summary, focus_domains, status, created_at")
          .eq(healthSubjectFilter.column, healthSubjectFilter.value)
          .order("created_at", { ascending: false })
          .limit(10)
      ),
      safeQuery(() =>
        admin
          .from("longevity_reports")
          .select("id, risk_score, primary_goal, created_at")
          .eq(healthSubjectFilter.column, healthSubjectFilter.value)
          .order("created_at", { ascending: false })
          .limit(8)
      ),
      safeQuery(() =>
        admin
          .from("notification_deliveries")
          .select("id, title, message, channel, status, created_at")
          .eq(healthSubjectFilter.column, healthSubjectFilter.value)
          .order("created_at", { ascending: false })
          .limit(10)
      ),
      safeQuery(() =>
        admin
          .from("future_self_scenarios")
          .select("id, title, description, share_token, is_public, version_number, protocol_id, projection, future_self, created_at")
          .eq(healthSubjectFilter.column, healthSubjectFilter.value)
          .order("created_at", { ascending: false })
          .limit(10)
      ),
      safeQuery(() =>
        admin
          .from("health_states")
          .select("baseline, risk_scores, insights, updated_at")
          .eq(healthSubjectFilter.column, healthSubjectFilter.value)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ),
      safeQuery(() =>
        admin
          .from("wearable_metrics")
          .select("id, provider, metric_name, metric_value, recorded_at")
          .eq(healthSubjectFilter.column, healthSubjectFilter.value)
          .order("recorded_at", { ascending: false })
          .limit(16)
      ),
      safeQuery(() =>
        admin
          .from("intervention_outcomes")
          .select("id, protocol_id, domain, action, success, outcome, confidence, notes, measured_at, created_at")
          .eq(healthSubjectFilter.column, healthSubjectFilter.value)
          .order("created_at", { ascending: false })
          .limit(16)
      ),
      safeQuery(() =>
        admin
          .from("health_metrics")
          .select("metric, value, measured_at, source")
          .eq(healthSubjectFilter.column, healthSubjectFilter.value)
          .order("measured_at", { ascending: false })
          .limit(80)
      ),
      safeQuery(() =>
        admin
          .from("clinical_insights")
          .select("id, domains, concern_status, confidence, created_at")
          .eq(healthSubjectFilter.column, healthSubjectFilter.value)
          .order("created_at", { ascending: false })
          .limit(12)
      ),
      safeQuery(() =>
        admin
          .from("agent_preferences")
          .select("id, category, preference_key, confidence, updated_at")
          .eq(healthSubjectFilter.column, healthSubjectFilter.value)
          .order("updated_at", { ascending: false })
          .limit(16)
      ),
      safeQuery(() =>
        admin
          .from("daily_execution_plans")
          .select("id, status, autopilot_mode, plan_date, updated_at")
          .eq(healthSubjectFilter.column, healthSubjectFilter.value)
          .order("plan_date", { ascending: false })
          .limit(10)
      ),
      safeQuery(() =>
        admin
          .from("calendar_events")
          .select("id, status, provider, scheduled_for, created_at")
          .eq(healthSubjectFilter.column, healthSubjectFilter.value)
          .order("scheduled_for", { ascending: false })
          .limit(16)
      ),
    ]);

    const counts = {
      assessments: assessmentRes.data?.length || 0,
      biologicalAgePoints: bioAgeRes.data?.length || 0,
      labs: labsRes.data?.length || 0,
      protocols: protocolRes.data?.length || 0,
      reports: reportRes.data?.length || 0,
      scenarios: scenarioRes.data?.length || 0,
      wearableMetrics: wearableRes.data?.length || 0,
      outcomes: outcomeRes.data?.length || 0,
      clinicalInsights: clinicalInsightRes.data?.length || 0,
      preferences: preferenceRes.data?.length || 0,
      dailyPlans: dailyPlanRes.data?.length || 0,
      calendarEvents: calendarRes.data?.length || 0,
    };

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
        counts,
        state: healthStateRes.data,
        bioAgeRows: bioAgeRes.data,
        healthMetricRows: healthMetricRes.data,
        outcomeRows: outcomeRes.data,
        labRows: labsRes.data,
      }),
      model: buildTwinModel({
        counts,
        bioAgeRows: bioAgeRes.data,
        clinicalInsightRows: clinicalInsightRes.data,
        dailyPlanRows: dailyPlanRes.data,
        healthMetricRows: healthMetricRes.data,
        labRows: labsRes.data,
        outcomeRows: outcomeRes.data,
        preferenceRows: preferenceRes.data,
        protocolRows: protocolRes.data,
        scenarioRows: scenarioRes.data,
        wearableRows: wearableRes.data,
      }),
      audit: buildTwinAudit({
        counts,
        bioAgeRows: bioAgeRes.data,
        clinicalInsightRows: clinicalInsightRes.data,
        healthMetricRows: healthMetricRes.data,
        labRows: labsRes.data,
        outcomeRows: outcomeRes.data,
        scenarioRows: scenarioRes.data,
        state: healthStateRes.data,
        wearableRows: wearableRes.data,
      }),
      timeline: events.slice(0, 60),
      counts,
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

function buildTwinAudit({
  bioAgeRows,
  clinicalInsightRows,
  counts,
  healthMetricRows,
  labRows,
  outcomeRows,
  scenarioRows,
  state,
  wearableRows,
}: {
  bioAgeRows: unknown;
  clinicalInsightRows: unknown;
  counts: Record<string, number>;
  healthMetricRows: unknown;
  labRows: unknown;
  outcomeRows: unknown;
  scenarioRows: unknown;
  state: unknown;
  wearableRows: unknown;
}): TwinAudit {
  const bioAge = asRows(bioAgeRows);
  const clinicalInsights = asRows(clinicalInsightRows);
  const healthMetrics = asRows(healthMetricRows);
  const labs = asRows(labRows);
  const outcomes = asRows(outcomeRows);
  const scenarios = asRows(scenarioRows);
  const wearables = asRows(wearableRows);
  const latestDate = latestSignalDate([
    ...bioAge.map((row) => text(row.created_at)),
    ...healthMetrics.map((row) => text(row.measured_at)),
    ...labs.map((row) => text(row.measured_at)),
    ...outcomes.map((row) => text(row.measured_at) || text(row.created_at)),
    ...scenarios.map((row) => text(row.created_at)),
    ...wearables.map((row) => text(row.recorded_at)),
    text((state as { updated_at?: unknown } | null)?.updated_at),
  ]);
  const daysOld = latestDate ? daysSince(latestDate) : null;
  const blindSpots = [];

  if (labs.length < 2) {
    blindSpots.push({
      actionHref: "/dashboard",
      label: "Biomarker direction",
      detail:
        "Aeonvera needs a second lab layer to separate true trend from a single baseline.",
    });
  }

  if (wearables.length < 5 && healthMetrics.length < 5) {
    blindSpots.push({
      actionHref: "/data-sources",
      label: "Live recovery signal",
      detail:
        "Wearable sleep, HRV, resting-heart-rate, and activity data make the twin more adaptive day to day.",
    });
  }

  if (outcomes.length < 2) {
    blindSpots.push({
      actionHref: "/digital-twin",
      label: "Reality feedback",
      detail:
        "Tracked outcomes teach the model which protocols actually work for this person.",
    });
  }

  if (!scenarios.length) {
    blindSpots.push({
      actionHref: "/optimization",
      label: "Future hypothesis",
      detail:
        "A saved future-self scenario gives Aeonvera something to compare against real changes.",
    });
  }

  if (!clinicalInsights.length) {
    blindSpots.push({
      actionHref: "/companion",
      label: "Clinical thread",
      detail:
        "Clinical follow-up memory helps the model connect symptoms, labs, recovery, and behavior.",
    });
  }

  return {
    blindSpots: blindSpots.slice(0, 4),
    evidencePriorities: buildEvidencePriorities({
      counts,
      healthMetrics,
      labs,
      outcomes,
      scenarios,
      wearables,
    }),
    freshness: {
      detail:
        daysOld == null
          ? "No live signal has reached the twin yet."
          : daysOld <= 7
            ? "Recent data is feeding the model."
            : daysOld <= 30
              ? "The twin is usable, but another fresh signal would improve confidence."
              : "The twin is relying on older evidence and should be refreshed before major decisions.",
      label:
        daysOld == null
          ? "No signal"
          : daysOld === 0
            ? "Updated today"
            : `${daysOld} day${daysOld === 1 ? "" : "s"} old`,
      status: daysOld == null || daysOld > 30 ? "stale" : daysOld > 7 ? "warming" : "current",
      updatedAt: latestDate || undefined,
    },
    recommendationReason: buildRecommendationReason({
      counts,
      outcomes,
      state,
      labs,
    }),
  };
}

function buildEvidencePriorities({
  counts,
  healthMetrics,
  labs,
  outcomes,
  scenarios,
  wearables,
}: {
  counts: Record<string, number>;
  healthMetrics: TimelineRow[];
  labs: TimelineRow[];
  outcomes: TimelineRow[];
  scenarios: TimelineRow[];
  wearables: TimelineRow[];
}) {
  const priorities = [];

  if (outcomes.length < 2) {
    priorities.push("Track two intervention outcomes so prediction can learn from reality.");
  }

  if (labs.length < 2) {
    priorities.push("Add another lab import to turn biomarker status into biomarker direction.");
  }

  if (wearables.length + healthMetrics.length < 10) {
    priorities.push("Connect or refresh wearable data so recovery and strain are current.");
  }

  if (!scenarios.length) {
    priorities.push("Run one future-self simulation so the twin can compare hypothesis against life.");
  }

  if ((counts.protocols || 0) < 1) {
    priorities.push("Generate one protocol to connect model insight to execution.");
  }

  return priorities.slice(0, 3);
}

function buildRecommendationReason({
  counts,
  labs,
  outcomes,
  state,
}: {
  counts: Record<string, number>;
  labs: TimelineRow[];
  outcomes: TimelineRow[];
  state: unknown;
}) {
  const riskScores = readRiskScores(state);
  const topRisk = Object.entries(riskScores).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
  const latestOutcome = outcomes[0];

  if (topRisk) {
    return `Aeonvera is prioritizing ${labelize(topRisk[0]).toLowerCase()} because it is currently the highest risk domain in the model at ${Math.round(Number(topRisk[1]))}%.`;
  }

  if (latestOutcome) {
    return `Aeonvera is using the latest tracked result, ${text(latestOutcome.action) || labelize(latestOutcome.domain)}, to decide whether the next protocol should reinforce or adjust course.`;
  }

  if (labs.length < 2) {
    return "Aeonvera is asking for more lab evidence because the model can see baseline status but not enough biomarker direction yet.";
  }

  if ((counts.scenarios || 0) < 1) {
    return "Aeonvera is recommending a scenario because the twin needs a future hypothesis before it can compare projected change against real outcomes.";
  }

  return "Aeonvera is recommending the next protocol because the model has enough baseline signal to begin learning from execution feedback.";
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

function buildTwinModel({
  counts,
  bioAgeRows,
  clinicalInsightRows,
  dailyPlanRows,
  healthMetricRows,
  labRows,
  outcomeRows,
  preferenceRows,
  protocolRows,
  scenarioRows,
  wearableRows,
}: {
  counts: Record<string, number>;
  bioAgeRows: unknown;
  clinicalInsightRows: unknown;
  dailyPlanRows: unknown;
  healthMetricRows: unknown;
  labRows: unknown;
  outcomeRows: unknown;
  preferenceRows: unknown;
  protocolRows: unknown;
  scenarioRows: unknown;
  wearableRows: unknown;
}): TwinModel {
  const bioAge = asRows(bioAgeRows);
  const clinicalInsights = asRows(clinicalInsightRows);
  const dailyPlans = asRows(dailyPlanRows);
  const healthMetrics = asRows(healthMetricRows);
  const labs = asRows(labRows);
  const outcomes = asRows(outcomeRows);
  const preferences = asRows(preferenceRows);
  const protocols = asRows(protocolRows);
  const scenarios = asRows(scenarioRows);
  const wearables = asRows(wearableRows);

  const domains: TwinDomain[] = [
    buildDomain({
      label: "Health",
      evidence: counts.assessments + counts.biologicalAgePoints + counts.labs,
      maxEvidence: 14,
      detail: `${counts.biologicalAgePoints || 0} biological-age point${counts.biologicalAgePoints === 1 ? "" : "s"} and ${counts.labs || 0} biomarker signal${counts.labs === 1 ? "" : "s"} are shaping the health layer.`,
    }),
    buildDomain({
      label: "Behavior",
      evidence: counts.preferences + counts.outcomes + counts.dailyPlans,
      maxEvidence: 24,
      detail: `${counts.preferences || 0} learned preference${counts.preferences === 1 ? "" : "s"}, ${counts.dailyPlans || 0} daily plan${counts.dailyPlans === 1 ? "" : "s"}, and ${counts.outcomes || 0} tracked outcome${counts.outcomes === 1 ? "" : "s"} are shaping behavior prediction.`,
    }),
    buildDomain({
      label: "Recovery",
      evidence: wearables.filter((row) =>
        /sleep|recovery|hrv|resting|readiness/i.test(
          [row.metric_name, row.provider].filter(Boolean).join(" ")
        )
      ).length,
      maxEvidence: 10,
      detail:
        "Sleep, recovery, HRV, and resting-heart-rate signals determine how hard Aeonvera should push the next plan.",
    }),
    buildDomain({
      label: "Clinical",
      evidence: clinicalInsights.length + labs.length,
      maxEvidence: 20,
      detail: `${clinicalInsights.length} clinical insight${clinicalInsights.length === 1 ? "" : "s"} and ${labs.length} lab import${labs.length === 1 ? "" : "s"} are available for deeper reasoning.`,
    }),
    buildDomain({
      label: "Scenario",
      evidence: scenarios.length + counts.protocols,
      maxEvidence: 14,
      detail: `${scenarios.length} future-self scenario${scenarios.length === 1 ? "" : "s"} and ${counts.protocols || 0} protocol${counts.protocols === 1 ? "" : "s"} connect simulation to execution.`,
    }),
    buildDomain({
      label: "Execution",
      evidence: dailyPlans.filter((row) =>
        ["accepted", "adjusted", "auto_scheduled"].includes(text(row.status))
      ).length + outcomes.length,
      maxEvidence: 18,
      detail:
        "Accepted plans, calendar execution, and outcome feedback teach the twin what actually changes your day.",
    }),
  ];

  const readinessScore = Math.round(average(domains.map((domain) => domain.score)));
  const readinessStatus =
    readinessScore >= 78
      ? "Living simulation"
      : readinessScore >= 56
        ? "Learning model"
        : readinessScore >= 34
          ? "Baseline model"
          : "Awaiting signals";

  return {
    domains,
    projectionComparisons: buildProjectionComparisons({
      bioAge,
      outcomes,
      protocols,
      scenarios,
    }),
    readiness: {
      detail: buildTwinReadinessDetail({
        bioAge,
        clinicalInsights,
        healthMetrics,
        outcomes,
        preferences,
        scenarios,
      }),
      score: readinessScore,
      status: readinessStatus,
    },
    scenarioPrompts: buildScenarioPrompts({
      bioAge,
      clinicalInsights,
      healthMetrics,
      outcomes,
      preferences,
      scenarios,
    }),
  };
}

function buildDomain({
  detail,
  evidence,
  label,
  maxEvidence,
}: {
  detail: string;
  evidence: number;
  label: string;
  maxEvidence: number;
}): TwinDomain {
  const score = Math.max(12, Math.min(96, Math.round((evidence / Math.max(maxEvidence, 1)) * 100)));
  return {
    detail,
    evidence,
    label,
    score,
    status: score >= 72 ? "strong" : score >= 38 ? "learning" : "thin",
  };
}

function buildProjectionComparisons({
  bioAge,
  outcomes,
  protocols,
  scenarios,
}: {
  bioAge: TimelineRow[];
  outcomes: TimelineRow[];
  protocols: TimelineRow[];
  scenarios: TimelineRow[];
}): TwinProjectionComparison[] {
  return scenarios
    .slice(0, 4)
    .map((scenario) => {
      const createdAt = Date.parse(text(scenario.created_at));
      const projection = safeObject(scenario.projection);
      const futureSelf = safeObject(scenario.future_self);
      const baseline = safeObject(futureSelf.baseline);
      const scenarioProtocolId = text(scenario.protocol_id);
      const linkedProtocol = protocols.find((row) => text(row.id) === scenarioProtocolId);
      const projectedImprovement =
        numberOrNull(projection.projectedBiologicalAgeImprovement) ??
        numberOrNull(projection.projectedAgeDeltaImprovement);
      const projectedBio =
        numberOrNull(projection.biologicalAge) ??
        numberOrNull(projection.projectedBiologicalAge);
      const baselineBio =
        numberOrNull(baseline.biologicalAge) ||
        numberOrNull(baseline.biological_age) ||
        null;
      const actualBio = bioAge.find((row) => {
        const measuredAt = Date.parse(text(row.created_at));
        return Number.isFinite(createdAt) && Number.isFinite(measuredAt) && measuredAt > createdAt;
      });
      const actualBioValue = numberOrNull(actualBio?.biological_age);
      const actualImprovement =
        baselineBio != null && actualBioValue != null
          ? round(baselineBio - actualBioValue, 1)
          : null;
      const relatedOutcomes = outcomes.filter((row) => {
        const measuredAt = Date.parse(text(row.measured_at) || text(row.created_at));
        const isAfterScenario =
          Number.isFinite(createdAt) && Number.isFinite(measuredAt) && measuredAt > createdAt;
        const matchesProtocol =
          !scenarioProtocolId || text(row.protocol_id) === scenarioProtocolId;
        return isAfterScenario && matchesProtocol;
      });
      const outcomeCount = relatedOutcomes.length;
      const actions = extractProtocolActions(linkedProtocol).concat(
        relatedOutcomes
          .map((row) => text(row.action))
          .filter(Boolean)
      );
      const uniqueActions = Array.from(new Set(actions)).slice(0, 3);

      const status: TwinProjectionComparison["status"] =
        actualImprovement == null
          ? outcomeCount
            ? "tracking"
            : "pending"
          : projectedImprovement != null && actualImprovement >= projectedImprovement * 0.65
            ? "on_track"
            : actualImprovement > 0
              ? "tracking"
              : "off_track";

      return {
        adjustment: buildProjectionAdjustment({
          actions: uniqueActions,
          outcomeCount,
          status,
          title: text(scenario.title) || "Saved projection",
        }),
        actual:
          actualImprovement != null
            ? `${actualImprovement > 0 ? "+" : ""}${actualImprovement.toFixed(1)} yrs actual`
            : outcomeCount
              ? `${outcomeCount} outcome${outcomeCount === 1 ? "" : "s"} logged`
              : undefined,
        detail: buildProjectionComparisonDetail({
          actualImprovement,
          actions: uniqueActions,
          linkedProtocolSummary: text(linkedProtocol?.summary),
          outcomeCount,
          projectedImprovement,
          status,
        }),
        actions: uniqueActions.length ? uniqueActions : undefined,
        confidence: buildProjectionReviewConfidence({
          actualImprovement,
          hasLinkedProtocol: Boolean(linkedProtocol),
          outcomeCount,
          projectedImprovement,
        }),
        evidenceMissing: buildProjectionMissingEvidence({
          actualImprovement,
          hasLinkedProtocol: Boolean(linkedProtocol),
          outcomeCount,
        }),
        followUpQuestion: buildProjectionFollowUpQuestion({
          actions: uniqueActions,
          status,
          title: text(scenario.title) || "Saved projection",
        }),
        linkedProtocol: linkedProtocol
          ? text(linkedProtocol.summary) || "Linked optimization protocol"
          : undefined,
        projected:
          projectedImprovement != null
            ? `${projectedImprovement.toFixed(1)} yrs projected`
            : projectedBio != null
              ? `${projectedBio.toFixed(1)} yrs target`
              : undefined,
        status,
        title: text(scenario.title) || "Saved projection",
      };
    })
    .filter((item) => item.projected || item.actual)
    .slice(0, 3);
}

function buildProjectionReviewConfidence({
  actualImprovement,
  hasLinkedProtocol,
  outcomeCount,
  projectedImprovement,
}: {
  actualImprovement: number | null;
  hasLinkedProtocol: boolean;
  outcomeCount: number;
  projectedImprovement: number | null;
}) {
  const score =
    34 +
    (projectedImprovement != null ? 16 : 0) +
    (hasLinkedProtocol ? 14 : 0) +
    Math.min(outcomeCount, 4) * 7 +
    (actualImprovement != null ? 18 : 0);

  return Math.min(94, Math.max(28, score));
}

function buildProjectionMissingEvidence({
  actualImprovement,
  hasLinkedProtocol,
  outcomeCount,
}: {
  actualImprovement: number | null;
  hasLinkedProtocol: boolean;
  outcomeCount: number;
}) {
  const missing = [];

  if (!hasLinkedProtocol) {
    missing.push("linked protocol");
  }

  if (!outcomeCount) {
    missing.push("tracked intervention outcome");
  }

  if (actualImprovement == null) {
    missing.push("new biological-age point");
  }

  return missing.slice(0, 3);
}

function buildProjectionFollowUpQuestion({
  actions,
  status,
  title,
}: {
  actions: string[];
  status: TwinProjectionComparison["status"];
  title: string;
}) {
  const action = actions[0];

  if (status === "on_track") {
    return action
      ? `Should Aeonvera reinforce ${action} for another cycle?`
      : `Should Aeonvera reinforce the pattern behind ${title}?`;
  }

  if (status === "off_track") {
    return action
      ? `Did ${action} fail because of adherence, intensity, timing, or the wrong lever?`
      : `Which assumption in ${title} did not survive real life?`;
  }

  if (status === "tracking") {
    return "Did the intervention improve, stay flat, or create friction since this projection?";
  }

  return "What evidence can Aeonvera collect next to test this projection?";
}

function buildProjectionAdjustment({
  actions,
  outcomeCount,
  status,
  title,
}: {
  actions: string[];
  outcomeCount: number;
  status: TwinProjectionComparison["status"];
  title: string;
}) {
  if (status === "on_track") {
    return {
      title: "Reinforce",
      detail:
        "Keep the protocol stable, add one repeat measurement, and avoid changing too many levers at once.",
    };
  }

  if (status === "off_track") {
    return {
      title: "Simplify",
      detail:
        "Reduce intensity, identify the friction point, and test one smaller behavior before trusting the projection.",
    };
  }

  if (outcomeCount) {
    return {
      title: "Measure",
      detail:
        "Outcome feedback exists. Add a biological-age or biomarker update so Aeonvera can quantify reality against the model.",
    };
  }

  return {
    title: "Test",
    detail: actions[0]
      ? `Start by tracking whether ${actions[0]} changed recovery, adherence, or symptoms.`
      : `Turn ${title} into one protocol action and log the result.`,
  };
}

function buildProjectionComparisonDetail({
  actualImprovement,
  actions,
  linkedProtocolSummary,
  outcomeCount,
  projectedImprovement,
  status,
}: {
  actualImprovement: number | null;
  actions: string[];
  linkedProtocolSummary: string;
  outcomeCount: number;
  projectedImprovement: number | null;
  status: TwinProjectionComparison["status"];
}) {
  const actionText = actions.length
    ? ` The leading action trail is ${actions.slice(0, 2).join(" and ")}.`
    : "";
  const protocolText = linkedProtocolSummary
    ? ` It is linked to this protocol: ${linkedProtocolSummary}.`
    : "";

  if (status === "on_track") {
    return `Reality is tracking close to the projection. Aeonvera can now reinforce the protocol pattern that appears to be working.${actionText || protocolText}`;
  }

  if (status === "off_track") {
    return `Reality is not matching the projection yet. Aeonvera should reduce friction, reassess assumptions, or choose a more realistic lever.${actionText || protocolText}`;
  }

  if (actualImprovement != null && projectedImprovement != null) {
    return `The projection expected ${projectedImprovement.toFixed(1)} years of separation; reality has moved ${actualImprovement.toFixed(1)} years so far.${actionText || protocolText}`;
  }

  if (outcomeCount) {
    return `Outcome feedback exists after this projection, but Aeonvera needs another biological-age point to quantify reality versus the simulation.${actionText || protocolText}`;
  }

  return `This projection is saved. Add outcomes or another biological-age update and Aeonvera will compare the simulation against reality.${protocolText}`;
}

function extractProtocolActions(protocolRow: TimelineRow | undefined) {
  const protocol = safeObject(protocolRow?.protocol);
  const primary = Array.isArray(protocol.primary_protocol)
    ? protocol.primary_protocol
    : [];

  return primary
    .map((item) => {
      const row = safeObject(item);
      return text(row.action);
    })
    .filter(Boolean);
}

function buildTwinReadinessDetail({
  bioAge,
  clinicalInsights,
  healthMetrics,
  outcomes,
  preferences,
  scenarios,
}: {
  bioAge: TimelineRow[];
  clinicalInsights: TimelineRow[];
  healthMetrics: TimelineRow[];
  outcomes: TimelineRow[];
  preferences: TimelineRow[];
  scenarios: TimelineRow[];
}) {
  if (bioAge.length >= 2 && outcomes.length >= 2 && scenarios.length >= 1) {
    return "Aeonvera can now compare biological-age direction, outcome feedback, and scenario intent inside one personal model.";
  }

  if (clinicalInsights.length && preferences.length && healthMetrics.length) {
    return "The twin has clinical memory, behavior preferences, and live health metrics. The next unlock is more outcome feedback.";
  }

  if (bioAge.length || healthMetrics.length || clinicalInsights.length) {
    return "The twin has a useful baseline. Add repeated outcomes and scenarios to make it predictive instead of descriptive.";
  }

  return "Complete the assessment, import labs or wearable data, and run one protocol so the twin can form its first baseline.";
}

function buildScenarioPrompts({
  bioAge,
  clinicalInsights,
  healthMetrics,
  outcomes,
  preferences,
  scenarios,
}: {
  bioAge: TimelineRow[];
  clinicalInsights: TimelineRow[];
  healthMetrics: TimelineRow[];
  outcomes: TimelineRow[];
  preferences: TimelineRow[];
  scenarios: TimelineRow[];
}): TwinScenarioPrompt[] {
  const prompts: TwinScenarioPrompt[] = [];
  const latestBio = numberOrNull(bioAge[0]?.biological_age);
  const topClinicalDomain = firstArrayText(clinicalInsights[0]?.domains);
  const strongestPreference = preferences[0];
  const latestOutcome = outcomes[0];
  const hasRecoveryMetrics = healthMetrics.some((row) =>
    /sleep|recovery|hrv|resting/i.test(text(row.metric))
  );

  if (latestBio != null) {
    prompts.push({
      question: "What happens if I lower my biological age by 2 years?",
      detail:
        "Projects the strongest levers across sleep, training, nutrition, recovery, biomarkers, and adherence.",
      href: "/optimization",
      scenarioIds: ["sleep-30", "vo2-15", "stress-reset", "training-consistency"],
    });
  }

  if (topClinicalDomain) {
    prompts.push({
      question: `What if I optimize ${labelize(topClinicalDomain).toLowerCase()} first?`,
      detail:
        "Uses clinical memory to ask what improves fastest, what needs labs, and what should be watched carefully.",
      href: "/optimization",
      scenarioIds: scenarioIdsForDomain(topClinicalDomain),
    });
  }

  if (hasRecoveryMetrics) {
    prompts.push({
      question: "What happens if I improve recovery for the next 30 days?",
      detail:
        "Compares sleep, HRV, training intensity, caffeine timing, and recovery interventions against expected readiness.",
      href: "/optimization",
      scenarioIds: ["sleep-30", "stress-reset"],
    });
  }

  if (latestOutcome) {
    prompts.push({
      question: `What should change after ${text(latestOutcome.action) || "my last intervention"}?`,
      detail:
        "Turns the last tracked result into the next protocol adjustment instead of treating it as a static log.",
      href: "/digital-twin",
      scenarioIds: scenarioIdsForDomain(text(latestOutcome.domain)),
    });
  }

  if (strongestPreference) {
    prompts.push({
      question: "What plan would fit the way I actually follow through?",
      detail:
        "Uses learned preferences and friction history to simulate a more realistic day, not an idealized one.",
      href: "/optimization",
      scenarioIds: ["training-consistency", "sleep-30"],
    });
  }

  if (!scenarios.length) {
    prompts.push({
      question: "What if I build my first future-self scenario?",
      detail:
        "Creates a baseline simulation that can later be compared against labs, wearables, and real outcomes.",
      href: "/optimization",
      scenarioIds: ["sleep-30", "training-consistency"],
    });
  }

  return prompts.slice(0, 4);
}

function scenarioIdsForDomain(value: string) {
  const normalized = value.toLowerCase();

  if (/sleep|recovery|stress|cortisol|anxiety|inflammation/.test(normalized)) {
    return ["sleep-30", "stress-reset"];
  }

  if (/cardio|heart|vo2|movement|training|exercise|fitness/.test(normalized)) {
    return ["vo2-15", "training-consistency"];
  }

  if (/weight|body|composition|metabolic|glucose|insulin|nutrition/.test(normalized)) {
    return ["lose-20-pounds", "training-consistency"];
  }

  return ["sleep-30", "training-consistency"];
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
    href: row.is_public && row.share_token ? `/future-self/${row.share_token}` : "/digital-twin",
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

function safeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function firstArrayText(value: unknown) {
  return Array.isArray(value) && typeof value[0] === "string" ? value[0] : "";
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

function latestSignalDate(values: string[]) {
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
  if (!Number.isFinite(time)) return null;

  return Math.max(0, Math.floor((Date.now() - time) / (24 * 60 * 60 * 1000)));
}

function isMissingTableError(error: unknown) {
  const candidate = error as { code?: string; message?: string };
  return (
    candidate.code === "42P01" ||
    candidate.code === "PGRST204" ||
    candidate.code === "PGRST205" ||
    candidate.message?.includes("schema cache")
  );
}
