import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Plan, SubscriptionStatus } from "@/lib/auth/permissions";
import type { LabTrend } from "@/lib/labs/labTrends";
import { loadLabTrendsForUser } from "@/lib/labs/loadLabTrendsForUser";
import {
  checkAndRecordUsage,
  serializeUsage,
  usageErrorResponse,
} from "@/lib/usage/tierUsage";
import {
  getRequestedHealthProfileId,
  getHealthSubjectFilter,
  healthSubjectInsertFields,
  resolveActiveHealthProfileContext,
} from "@/lib/health-profiles/activeHealthProfile";
import { rateLimitRequest } from "@/lib/security/rateLimit";

type Question = {
  id: string;
  domain: string;
  prompt: string;
  options: string[];
};

type ProtocolAction = {
  domain: string;
  action: string;
  why: string;
  cadence: string;
  impact: "low" | "medium" | "high";
};

type WeeklySequence = {
  week: string;
  focus: string;
  actions: string[];
};

type TrackingMetric = {
  metric: string;
  target: string;
  source: string;
};

type OptimizationProtocol = {
  summary: string;
  focus_domains: string[];
  primary_protocol: ProtocolAction[];
  weekly_sequence: WeeklySequence[];
  tracking_metrics: TrackingMetric[];
  coach_message: string;
};

type ProjectionContext = {
  controls?: Record<string, number>;
  projection?: {
    biologicalAge?: number;
    ageDelta?: number;
    score?: number;
    projectedAgeDeltaImprovement?: number;
    projectedBiologicalAgeImprovement?: number;
  };
};

let openaiClient: OpenAI | null = null;

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) return null;

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }

  return openaiClient;
}

export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimitRequest(request, "optimization-protocol", 10, 60_000);
    if (limited) return limited;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const answers = sanitizeAnswers(body.answers);
    const questions = sanitizeQuestions(body.questions);
    const context = sanitizeContext(body.context);
    const projectionContext = sanitizeProjectionContext(body.projectionContext);
    const sourceScenarioShareToken = sanitizeShareToken(body.sourceScenarioShareToken);
    const enrichedContext = appendProjectionContext(context, projectionContext);

    if (
      (!questions.length || Object.keys(answers).length < questions.length) &&
      !projectionContext
    ) {
      return NextResponse.json(
        { error: "Complete the optimization intake before building a protocol." },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();
    const healthProfileContext = await resolveActiveHealthProfileContext({
      supabase: admin,
      loginUserId: user.id,
      requestedHealthProfileId: getRequestedHealthProfileId(request),
    });
    const healthSubjectFilter = getHealthSubjectFilter(healthProfileContext);

    const [
      { data: profile },
      { data: assessment },
      { data: healthState },
      { data: recentReport },
      labTrends,
    ] =
      await Promise.all([
        admin.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
        admin
          .from("longevity_assessments")
          .select("*")
          .eq(healthSubjectFilter.column, healthSubjectFilter.value)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        admin
          .from("health_states")
          .select("*")
          .eq(healthSubjectFilter.column, healthSubjectFilter.value)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        admin
          .from("longevity_reports")
          .select("report, risk_score, primary_goal, created_at")
          .eq(healthSubjectFilter.column, healthSubjectFilter.value)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        loadLabTrendsForUser(admin, user.id, healthProfileContext.healthProfileId),
      ]);

    const usage = await checkAndRecordUsage({
      healthProfileId: healthProfileContext.healthProfileId,
      metadata: { source: "optimization_protocol" },
      meter: "optimization_protocol",
      plan: ((profile as { plan?: Plan | null } | null)?.plan as Plan | null) || null,
      status:
        ((profile as { subscription_status?: SubscriptionStatus | null } | null)
          ?.subscription_status as SubscriptionStatus | null) || null,
      supabase: admin,
      userId: user.id,
    });

    if (!usage.allowed) {
      return NextResponse.json(
        usageErrorResponse(usage),
        { status: usage.statusCode || 429 }
      );
    }

    const intakeResult = await admin
      .from("optimization_intakes")
      .insert({
        ...healthSubjectInsertFields(healthProfileContext),
        user_id: user.id,
        answers,
        context: enrichedContext,
        questions,
      })
      .select("id, created_at")
      .single();

    if (intakeResult.error) {
      console.error("Optimization intake insert failed:", intakeResult.error);
      return NextResponse.json(
        {
          error:
            "Optimization tables are not live yet. Apply supabase/migrations/20260610130000_optimization_protocols.sql in Supabase, then try again.",
        },
        { status: 500 }
      );
    }

    const generated = await generateProtocol({
      answers,
      questions,
      context: enrichedContext,
      profile,
      assessment,
      healthState,
      recentReport,
      labTrends,
      projectionContext,
    });

    const protocolResult = await admin
      .from("optimization_protocols")
      .insert({
        ...healthSubjectInsertFields(healthProfileContext),
        user_id: user.id,
        intake_id: intakeResult.data.id,
        protocol: generated.protocol,
        summary: generated.protocol.summary,
        focus_domains: generated.protocol.focus_domains,
        status: generated.status,
      })
      .select("id, protocol, summary, focus_domains, status, created_at")
      .single();

    if (protocolResult.error) {
      console.error("Optimization protocol save failed:", protocolResult.error);
      return NextResponse.json(
        { error: "Failed to save optimization protocol." },
        { status: 500 }
      );
    }

    await recordOptimizationDelivery({
      healthProfileId: healthProfileContext.healthProfileId,
      userId: user.id,
      protocolId: protocolResult.data.id,
      title: "Optimization protocol is ready",
      message: generated.protocol.coach_message || generated.protocol.summary,
    });

    if (sourceScenarioShareToken) {
      await linkScenarioProtocol({
        userId: user.id,
        shareToken: sourceScenarioShareToken,
        protocolId: protocolResult.data.id,
      });
    }

    return NextResponse.json({
      success: true,
      intake: intakeResult.data,
      protocol: protocolResult.data,
      usage: serializeUsage(usage),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to build optimization protocol.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function linkScenarioProtocol({
  userId,
  shareToken,
  protocolId,
}: {
  userId: string;
  shareToken: string;
  protocolId: string;
}) {
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from("future_self_scenarios")
      .update({ protocol_id: protocolId })
      .eq("user_id", userId)
      .eq("share_token", shareToken);

    if (error && !isMissingScenarioLinkColumn(error)) {
      console.error("[Scenario Protocol Link Error]", error.message);
    }
  } catch (error) {
    console.error(
      "[Scenario Protocol Link Error]",
      error instanceof Error ? error.message : error
    );
  }
}

async function generateProtocol(params: {
  answers: Record<string, string>;
  questions: Question[];
  context: string;
  profile: unknown;
  assessment: unknown;
  healthState: unknown;
  recentReport: unknown;
  labTrends: LabTrend[];
  projectionContext: ProjectionContext | null;
}): Promise<{ protocol: OptimizationProtocol; status: "generated" | "fallback" }> {
  const openai = getOpenAI();

  if (!openai) {
    return {
      protocol: buildFallbackProtocol(params.answers, params.context, params.projectionContext, params.labTrends),
      status: "fallback",
    };
  }

  const prompt = `
You are Aeonvera, a proactive longevity optimization intelligence.

Build a precise optimization protocol from this user's intake and available health context.
Use the user's constraints, sleep/recovery pattern, assessment, health state, and latest report.
Be specific, measurable, and premium. Avoid medical diagnosis. Prefer lifestyle, tracking, and coachable behavior.

INTAKE ANSWERS:
${JSON.stringify(params.answers, null, 2)}

INTAKE QUESTIONS:
${JSON.stringify(params.questions, null, 2)}

USER CONTEXT:
${params.context || "No extra context provided."}

PROFILE:
${JSON.stringify(params.profile, null, 2)}

ASSESSMENT:
${JSON.stringify(params.assessment, null, 2)}

HEALTH STATE:
${JSON.stringify(params.healthState, null, 2)}

LATEST REPORT:
${JSON.stringify(params.recentReport, null, 2)}

CLINICAL LAB TRENDS:
${params.labTrends.length ? JSON.stringify(params.labTrends, null, 2) : "No clinical lab trend history yet."}

SIMULATOR PROJECTION:
${params.projectionContext ? JSON.stringify(params.projectionContext, null, 2) : "No simulator projection provided."}

When simulator projection is present, use it as the central protocol target. Tie actions to the adjusted levers, projected biological age, and measurable improvement estimate.
When clinical lab trends are present, prioritize worsening biomarkers first, reinforce improving biomarkers second, and connect actions to measurable retesting targets without diagnosing disease.

Return raw JSON only. No markdown fences.
Schema:
{
  "summary": string,
  "focus_domains": [string],
  "primary_protocol": [
    {
      "domain": string,
      "action": string,
      "why": string,
      "cadence": string,
      "impact": "low" | "medium" | "high"
    }
  ],
  "weekly_sequence": [
    {
      "week": string,
      "focus": string,
      "actions": [string]
    }
  ],
  "tracking_metrics": [
    {
      "metric": string,
      "target": string,
      "source": string
    }
  ],
  "coach_message": string
}
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are Aeonvera's optimization engine. Respond with strict raw JSON only.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.25,
      max_tokens: 1400,
    });

    const raw = completion.choices?.[0]?.message?.content?.trim();

    if (!raw) {
      return {
        protocol: buildFallbackProtocol(params.answers, params.context, params.projectionContext, params.labTrends),
        status: "fallback",
      };
    }

    const parsed = JSON.parse(stripJsonFences(raw)) as Partial<OptimizationProtocol>;

    return {
      protocol: normalizeProtocol(
        parsed,
        params.answers,
        params.context,
        params.projectionContext,
        params.labTrends
      ),
      status: "generated",
    };
  } catch (error) {
    console.error(
      "[Optimization Protocol Error]",
      error instanceof Error ? error.message : error
    );

    return {
      protocol: buildFallbackProtocol(params.answers, params.context, params.projectionContext, params.labTrends),
      status: "fallback",
    };
  }
}

function normalizeProtocol(
  protocol: Partial<OptimizationProtocol>,
  answers: Record<string, string>,
  context: string,
  projectionContext: ProjectionContext | null,
  labTrends: LabTrend[] = []
): OptimizationProtocol {
  const fallback = buildFallbackProtocol(answers, context, projectionContext, labTrends);

  return {
    summary: protocol.summary || fallback.summary,
    focus_domains: cleanStringArray(protocol.focus_domains, fallback.focus_domains).slice(0, 5),
    primary_protocol: cleanProtocolActions(
      protocol.primary_protocol,
      fallback.primary_protocol
    ).slice(0, 6),
    weekly_sequence: cleanWeeklySequence(
      protocol.weekly_sequence,
      fallback.weekly_sequence
    ).slice(0, 4),
    tracking_metrics: cleanTrackingMetrics(
      protocol.tracking_metrics,
      fallback.tracking_metrics
    ).slice(0, 5),
    coach_message: protocol.coach_message || fallback.coach_message,
  };
}

function buildFallbackProtocol(
  answers: Record<string, string>,
  context: string,
  projectionContext: ProjectionContext | null = null,
  labTrends: LabTrend[] = []
): OptimizationProtocol {
  const priority = answers.priority || "More energy";
  const sleep = answers.sleep || "Inconsistent schedule";
  const nutrition = answers.nutrition || "Protein consistency";
  const training = answers.training || "Inconsistent";
  const metabolic = answers.metabolic || "Glucose stability";
  const stress = answers.stress || "Evening recovery";
  const cognitive = answers.cognitive || "Calm focus";
  const projectionImprovement =
    projectionContext?.projection?.projectedAgeDeltaImprovement;
  const projectionSummary = projectionImprovement
    ? ` The simulator projects up to ${projectionImprovement.toFixed(1)} years of biological-age improvement from the selected levers.`
    : "";
  const clinicalPriority = labTrends.find((trend) => trend.status === "worsening");
  const clinicalWin = labTrends.find((trend) => trend.status === "improving");
  const clinicalSummary = clinicalPriority
    ? ` The newest clinical priority is ${clinicalPriority.label}, which moved away from target.`
    : clinicalWin
    ? ` The newest clinical reinforcement signal is ${clinicalWin.label}, which is moving favorably.`
    : "";
  const clinicalAction = clinicalPriority
    ? buildClinicalProtocolAction(clinicalPriority)
    : clinicalWin
    ? {
        domain: "Clinical trend",
        action: `Keep the current rhythm steady and retest ${clinicalWin.label} on the next lab cycle.`,
        why: `${clinicalWin.label} is moving in a favorable direction, so the protocol should preserve the behaviors that likely supported it.`,
        cadence: "Review weekly until next lab import",
        impact: "medium" as const,
      }
    : null;
  const primaryProtocol = [
    clinicalAction,
    {
      domain: "Sleep",
      action: `Stabilize the factor most limiting recovery: ${sleep.toLowerCase()}.`,
      why: "Sleep consistency is the highest-leverage signal for recovery, appetite control, glucose stability, and cognitive output.",
      cadence: "Nightly for 14 days",
      impact: "high" as const,
    },
    {
      domain: "Nutrition",
      action: `Build the first meal around ${nutrition.toLowerCase()} and repeat it on workdays.`,
      why: "A repeatable nutrition anchor reduces decision fatigue and improves metabolic predictability.",
      cadence: "5 days per week",
      impact: "medium" as const,
    },
    {
      domain: "Movement",
      action: `Convert your current pattern (${training.toLowerCase()}) into three planned movement blocks.`,
      why: "Planned movement improves adherence and gives Aeonvera a cleaner signal to optimize against.",
      cadence: "3 sessions per week",
      impact: "high" as const,
    },
    {
      domain: "Metabolic",
      action: `Track the metabolic signal you chose first: ${metabolic.toLowerCase()}.`,
      why: "The protocol should improve one measurable metabolic signal before expanding complexity.",
      cadence: "Weekly review",
      impact: "medium" as const,
    },
    {
      domain: "Stress",
      action: `Protect the point where stress most affects you: ${stress.toLowerCase()}.`,
      why: "Lower friction recovery windows improve sleep onset, training readiness, and dietary consistency.",
      cadence: "Daily 10-minute reset",
      impact: "medium" as const,
    },
    {
      domain: "Cognition",
      action: `Schedule one protected block for ${cognitive.toLowerCase()}.`,
      why: "Cognitive performance improves when energy, sleep, and stress interventions are tied to a real weekly output.",
      cadence: "2 blocks per week",
      impact: "medium" as const,
    },
  ].filter((action): action is ProtocolAction => Boolean(action));

  return {
    summary: `Your first protocol prioritizes ${priority.toLowerCase()} by tightening sleep, nutrition, movement, and recovery into one measurable rhythm.${projectionSummary}${clinicalSummary}`,
    focus_domains: clinicalPriority
      ? ["Clinical trend", clinicalPriority.label, "Sleep", "Metabolic", "Recovery"]
      : ["Sleep", "Metabolic", "Movement", "Recovery"],
    primary_protocol: primaryProtocol.slice(0, 6),
    weekly_sequence: [
      {
        week: "1-2",
        focus: "Stabilize baseline",
        actions: ["Lock wake time", "Choose the repeatable first meal", "Complete three movement blocks"],
      },
      {
        week: "3-4",
        focus: "Increase precision",
        actions: ["Review resting heart rate and sleep trend", "Adjust training intensity", "Tighten evening recovery"],
      },
      {
        week: "5-8",
        focus: "Compound gains",
        actions: ["Add one advanced metabolic lever", "Progress strength or zone-2 volume", "Regenerate the protocol"],
      },
    ],
    tracking_metrics: [
      ...(clinicalPriority
        ? [
            {
              metric: clinicalPriority.label,
              target: clinicalPriority.target,
              source: "Clinical lab import",
            },
          ]
        : []),
      { metric: "Resting heart rate", target: "Stable or down 2-4 bpm", source: "Wearable or manual check-in" },
      { metric: "Sleep duration", target: "7.5+ hours average", source: "Wearable or assessment" },
      { metric: "Training adherence", target: "3 planned sessions weekly", source: "Manual check-in" },
      { metric: "Energy", target: "Higher morning score", source: "Optimization intake" },
    ].slice(0, 5),
    coach_message: buildFallbackCoachMessage({
      hasContext: Boolean(context),
      hasProjection: Boolean(projectionContext),
      hasClinicalTrends: labTrends.length > 0,
    }),
  };
}

function buildFallbackCoachMessage({
  hasContext,
  hasProjection,
  hasClinicalTrends,
}: {
  hasContext: boolean;
  hasProjection: boolean;
  hasClinicalTrends: boolean;
}) {
  const sources = [
    hasContext ? "extra context" : null,
    hasProjection ? "simulator projection" : null,
    hasClinicalTrends ? "clinical trends" : null,
  ].filter(Boolean);

  if (sources.length) {
    return `I used your ${sources.join(", ")} to keep this protocol realistic. Start with the first two weeks, then I will adapt it from your trend data.`;
  }

  return "Start with the first two weeks. Once your wearable and check-in signals update, I will adapt the protocol automatically.";
}

function buildClinicalProtocolAction(trend: LabTrend): ProtocolAction {
  const unit = trend.unit ? ` ${trend.unit}` : "";

  switch (trend.canonicalKey) {
    case "fasting_glucose":
      return {
        domain: "Clinical trend",
        action: "Add a 10-minute walk after your two highest-carbohydrate meals and anchor breakfast with protein.",
        why: `Fasting Glucose moved away from target. Latest value: ${trend.latestValue}${unit}.`,
        cadence: "Daily for 14 days, then review",
        impact: "high",
      };
    case "hscrp":
      return {
        domain: "Clinical trend",
        action: "Run a 7-day inflammation reset: protect sleep, reduce training intensity, and remove the most obvious inflammatory trigger.",
        why: `hsCRP moved away from target. Latest value: ${trend.latestValue}${unit}.`,
        cadence: "Daily for 7 days",
        impact: "high",
      };
    case "albumin":
      return {
        domain: "Clinical trend",
        action: "Increase protein consistency and review hydration before the next lab cycle.",
        why: `Albumin moved away from target. Latest value: ${trend.latestValue}${unit}.`,
        cadence: "5 days per week",
        impact: "medium",
      };
    default:
      return {
        domain: "Clinical trend",
        action: `Make ${trend.label} the next tracked clinical marker and retest after the next protocol cycle.`,
        why: `${trend.label} moved away from target. Latest value: ${trend.latestValue}${unit}.`,
        cadence: "Weekly review until next lab import",
        impact: "medium",
      };
  }
}

async function recordOptimizationDelivery({
  healthProfileId,
  userId,
  protocolId,
  title,
  message,
}: {
  healthProfileId?: string | null;
  userId: string;
  protocolId: string;
  title: string;
  message: string;
}) {
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("notification_deliveries").insert({
      ...(healthProfileId ? { health_profile_id: healthProfileId } : {}),
      user_id: userId,
      channel: "in_app",
      status: "sent",
      title,
      message,
      payload: {
        source: "optimization_protocol",
        protocol_id: protocolId,
      },
      sent_at: new Date().toISOString(),
    });

    if (error && !isMissingNotificationTable(error)) {
      console.error("[Optimization Delivery Error]", error.message);
    }
  } catch (error) {
    console.error(
      "[Optimization Delivery Error]",
      error instanceof Error ? error.message : error
    );
  }
}

function sanitizeAnswers(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .flatMap(([key, answer]) =>
        key && typeof answer === "string"
          ? [[key.slice(0, 64), answer.slice(0, 160)]]
          : []
      )
  );
}

function sanitizeQuestions(value: unknown): Question[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((question) => {
      if (!question || typeof question !== "object") return null;
      const candidate = question as Record<string, unknown>;

      if (
        typeof candidate.id !== "string" ||
        typeof candidate.domain !== "string" ||
        typeof candidate.prompt !== "string"
      ) {
        return null;
      }

      return {
        id: candidate.id.slice(0, 64),
        domain: candidate.domain.slice(0, 80),
        prompt: candidate.prompt.slice(0, 220),
        options: Array.isArray(candidate.options)
          ? candidate.options
              .filter((option): option is string => typeof option === "string")
              .map((option) => option.slice(0, 120))
              .slice(0, 8)
          : [],
      };
    })
    .filter((question): question is Question => Boolean(question));
}

function sanitizeContext(value: unknown) {
  return typeof value === "string" ? value.slice(0, 2400) : "";
}

function sanitizeProjectionContext(value: unknown): ProjectionContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const candidate = value as Record<string, unknown>;
  const controls =
    candidate.controls && typeof candidate.controls === "object" && !Array.isArray(candidate.controls)
      ? cleanNumericRecord(candidate.controls as Record<string, unknown>)
      : undefined;
  const projection =
    candidate.projection && typeof candidate.projection === "object" && !Array.isArray(candidate.projection)
      ? cleanProjection(candidate.projection as Record<string, unknown>)
      : undefined;

  if (!controls && !projection) return null;

  return { controls, projection };
}

function sanitizeShareToken(value: unknown) {
  if (typeof value !== "string") return "";

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : "";
}

function appendProjectionContext(
  context: string,
  projectionContext: ProjectionContext | null
) {
  if (!projectionContext) return context;

  const projectionText = `Simulator projection: ${JSON.stringify(projectionContext)}`;
  return [context, projectionText].filter(Boolean).join("\n\n").slice(0, 2400);
}

function cleanNumericRecord(value: Record<string, unknown>) {
  const entries = Object.entries(value).flatMap(([key, candidate]) => {
    const numberValue = Number(candidate);
    return Number.isFinite(numberValue)
      ? [[key.slice(0, 64), numberValue] as const]
      : [];
  });

  return entries.length ? Object.fromEntries(entries) : undefined;
}

function cleanProjection(value: Record<string, unknown>) {
  const projection: NonNullable<ProjectionContext["projection"]> = {};

  for (const key of [
    "biologicalAge",
    "ageDelta",
    "score",
    "projectedAgeDeltaImprovement",
    "projectedBiologicalAgeImprovement",
  ] as const) {
    const numberValue = Number(value[key]);
    if (Number.isFinite(numberValue)) projection[key] = numberValue;
  }

  return Object.keys(projection).length ? projection : undefined;
}

function stripJsonFences(value: string) {
  return value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

function cleanStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;

  const cleaned = value.filter((item): item is string => typeof item === "string");
  return cleaned.length ? cleaned : fallback;
}

function cleanProtocolActions(value: unknown, fallback: ProtocolAction[]) {
  if (!Array.isArray(value)) return fallback;

  const cleaned = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const action = item as Record<string, unknown>;

      if (
        typeof action.domain !== "string" ||
        typeof action.action !== "string" ||
        typeof action.why !== "string" ||
        typeof action.cadence !== "string"
      ) {
        return null;
      }

      return {
        domain: action.domain,
        action: action.action,
        why: action.why,
        cadence: action.cadence,
        impact: normalizeImpact(action.impact),
      };
    })
    .filter((item): item is ProtocolAction => Boolean(item));

  return cleaned.length ? cleaned : fallback;
}

function cleanWeeklySequence(value: unknown, fallback: WeeklySequence[]) {
  if (!Array.isArray(value)) return fallback;

  const cleaned = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const sequence = item as Record<string, unknown>;

      if (
        typeof sequence.week !== "string" ||
        typeof sequence.focus !== "string" ||
        !Array.isArray(sequence.actions)
      ) {
        return null;
      }

      return {
        week: sequence.week,
        focus: sequence.focus,
        actions: sequence.actions.filter(
          (action): action is string => typeof action === "string"
        ),
      };
    })
    .filter((item): item is WeeklySequence => Boolean(item));

  return cleaned.length ? cleaned : fallback;
}

function cleanTrackingMetrics(value: unknown, fallback: TrackingMetric[]) {
  if (!Array.isArray(value)) return fallback;

  const cleaned = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const metric = item as Record<string, unknown>;

      if (
        typeof metric.metric !== "string" ||
        typeof metric.target !== "string" ||
        typeof metric.source !== "string"
      ) {
        return null;
      }

      return {
        metric: metric.metric,
        target: metric.target,
        source: metric.source,
      };
    })
    .filter((item): item is TrackingMetric => Boolean(item));

  return cleaned.length ? cleaned : fallback;
}

function normalizeImpact(value: unknown): ProtocolAction["impact"] {
  return value === "low" || value === "medium" || value === "high"
    ? value
    : "medium";
}

function isMissingNotificationTable(error: { message?: string; code?: string }) {
  return (
    error.code === "PGRST205" ||
    error.message?.includes("notification_deliveries") ||
    error.message?.includes("schema cache")
  );
}

function isMissingScenarioLinkColumn(error: { message?: string; code?: string }) {
  return (
    error.code === "PGRST204" ||
    error.code === "PGRST205" ||
    error.message?.includes("protocol_id") ||
    error.message?.includes("future_self_scenarios") ||
    error.message?.includes("schema cache")
  );
}
