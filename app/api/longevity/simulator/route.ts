import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  computeBiologicalAge,
  type AssessmentInput,
  type BiologicalAgeResult,
} from "@/lib/longevity/biologicalAgeEngine";
import { buildAssessmentInput } from "@/lib/longevity/assessmentInput";
import { loadLatestLabInputValues } from "@/lib/labs/latestLabInputs";
import {
  FUTURE_SELF_SCENARIOS,
  applyFutureSelfScenarios,
  buildDefaultFutureSelfControls,
  buildFutureSelfProjection,
  normalizeFutureSelfControls,
  type FutureSelfControls,
} from "@/lib/longevity/futureSelfSimulator";
import {
  checkAndRecordUsage,
  serializeUsage,
  usageErrorResponse,
} from "@/lib/usage/tierUsage";
import type { Plan, SubscriptionStatus } from "@/lib/auth/permissions";
import {
  getHealthSubjectFilter,
  resolveActiveHealthProfileContext,
} from "@/lib/health-profiles/activeHealthProfile";

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<Awaited<ReturnType<typeof cookies>>["set"]>[2];
};

type SimulationScenario = {
  id: string;
  title: string;
  domain: string;
  action: string;
  horizon: string;
  apply: (input: AssessmentInput) => AssessmentInput;
};

type SimulatorControls = FutureSelfControls;

async function getSupabaseUser() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

export async function GET() {
  try {
    const context = await getLatestAssessmentContext();
    const usage = await checkAndRecordUsage({
      metadata: { source: "future_self_presets" },
      meter: "future_self_simulation",
      plan: context.plan,
      status: context.status,
      supabase: context.supabase,
      healthProfileId: context.healthProfileId,
      userId: context.userId,
    });

    if (!usage.allowed) {
      return NextResponse.json(
        usageErrorResponse(usage),
        { status: usage.statusCode || 429 }
      );
    }

    const input = context.input;
    const baseline = computeBiologicalAge(input);
    const controls = buildControls(input);
    const futureSelf = buildFutureSelfProjection({ input, controls });
    const simulations = SCENARIOS.map((scenario) =>
      buildSimulation(scenario, baseline, input)
    )
      .sort((a, b) => b.projectedAgeDeltaImprovement - a.projectedAgeDeltaImprovement)
      .slice(0, 5);

    return NextResponse.json({
      baseline: summarizeResult(baseline),
      controls,
      futureSelf,
      scenarioPresets: summarizeScenarioPresets(),
      simulations,
      usage: serializeUsage(usage),
    });
  } catch (error) {
    if (error instanceof SimulatorError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message =
      error instanceof Error ? error.message : "Failed to run biological age simulator.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getLatestAssessmentContext();
    const usage = await checkAndRecordUsage({
      metadata: { source: "future_self_custom" },
      meter: "future_self_simulation",
      plan: context.plan,
      status: context.status,
      supabase: context.supabase,
      healthProfileId: context.healthProfileId,
      userId: context.userId,
    });

    if (!usage.allowed) {
      return NextResponse.json(
        usageErrorResponse(usage),
        { status: usage.statusCode || 429 }
      );
    }

    const input = context.input;
    const baseline = computeBiologicalAge(input);
    const body = await readJsonBody(request);
    const scenarioIds = sanitizeScenarioIds(body?.scenarioIds);
    const manualControls = normalizeControls(body?.controls, buildControls(input));
    const controls = scenarioIds.length
      ? applyFutureSelfScenarios(manualControls, scenarioIds)
      : manualControls;
    const futureSelf = buildFutureSelfProjection({
      input,
      controls,
      activeScenarioIds: scenarioIds,
    });
    const projected = futureSelf.optimized;

    return NextResponse.json({
      baseline: summarizeResult(baseline),
      controls,
      futureSelf,
      scenarioPresets: summarizeScenarioPresets(),
      activeScenarioIds: scenarioIds,
      projection: {
        ...projected,
        projectedAgeDeltaImprovement: futureSelf.optimized.projectedAgeDeltaImprovement,
        projectedBiologicalAgeImprovement:
          futureSelf.optimized.projectedBiologicalAgeImprovement,
      },
      usage: serializeUsage(usage),
    });
  } catch (error) {
    if (error instanceof SimulatorError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message =
      error instanceof Error ? error.message : "Failed to run custom simulator.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function getLatestAssessmentContext() {
  const supabaseUser = await getSupabaseUser();
  const { data: { user }, error: userError } = await supabaseUser.auth.getUser();

  if (userError || !user) {
    throw new SimulatorError("Unauthorized", 401);
  }

  const supabase = getSupabaseAdmin();
  const healthProfileContext = await resolveActiveHealthProfileContext({
    supabase,
    loginUserId: user.id,
  });
  const healthFilter = getHealthSubjectFilter(healthProfileContext);
  const [{ data: assessment, error: assessmentError }, { data: profile }] = await Promise.all([
    supabase
      .from("longevity_assessments")
      .select("*")
      .eq(healthFilter.column, healthFilter.value)
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("profiles")
      .select("plan,subscription_status")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (assessmentError || !assessment) {
    throw new SimulatorError("No assessment found.", 404);
  }

  return {
    input: {
      ...buildAssessmentInput(assessment),
      ...(await loadLatestLabInputValues({
        supabase,
        userId: user.id,
        healthProfileId: healthProfileContext.healthProfileId,
      })),
    },
    healthProfileId: healthProfileContext.healthProfileId,
    plan: ((profile as { plan?: Plan | null } | null)?.plan as Plan | null) || null,
    status:
      ((profile as { subscription_status?: SubscriptionStatus | null } | null)
        ?.subscription_status as SubscriptionStatus | null) || null,
    supabase,
    userId: user.id,
  };
}

function buildSimulation(
  scenario: SimulationScenario,
  baseline: BiologicalAgeResult,
  input: AssessmentInput
) {
  const simulated = computeBiologicalAge(scenario.apply(input));
  const projectedAgeDeltaImprovement = Number(
    (baseline.ageDelta - simulated.ageDelta).toFixed(1)
  );
  const projectedBiologicalAgeImprovement = Number(
    (baseline.biologicalAge - simulated.biologicalAge).toFixed(1)
  );

  return {
    id: scenario.id,
    title: scenario.title,
    domain: scenario.domain,
    action: scenario.action,
    horizon: scenario.horizon,
    projectedAgeDeltaImprovement,
    projectedBiologicalAgeImprovement,
    projectedBiologicalAge: simulated.biologicalAge,
    projectedScore: simulated.score,
    confidence: simulated.accuracyScore,
    keyDrivers: simulated.factors
      .filter((factor) => factor.status === "positive")
      .slice(0, 3)
      .map((factor) => factor.label),
  };
}

function buildControls(input: AssessmentInput): SimulatorControls {
  return buildDefaultFutureSelfControls(input);
}

function normalizeControls(
  value: unknown,
  fallback: SimulatorControls
): SimulatorControls {
  return normalizeFutureSelfControls(value, fallback);
}

function sanitizeScenarioIds(value: unknown) {
  if (!Array.isArray(value)) return [];

  const allowed = new Set(FUTURE_SELF_SCENARIOS.map((scenario) => scenario.id));
  return Array.from(
    new Set(
      value.filter(
        (scenarioId): scenarioId is string =>
          typeof scenarioId === "string" && allowed.has(scenarioId)
      )
    )
  ).slice(0, 5);
}

function summarizeScenarioPresets() {
  return FUTURE_SELF_SCENARIOS.map((scenario) => ({
    id: scenario.id,
    title: scenario.title,
    domain: scenario.domain,
    description: scenario.description,
    horizon: scenario.horizon,
  }));
}

async function readJsonBody(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function summarizeResult(result: BiologicalAgeResult) {
  return {
    chronologicalAge: result.chronologicalAge,
    biologicalAge: result.biologicalAge,
    ageDelta: result.ageDelta,
    score: result.score,
    accuracyScore: result.accuracyScore,
    category: result.category,
  };
}

class SimulatorError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const SCENARIOS: SimulationScenario[] = [
  {
    id: "sleep-recovery",
    title: "Stabilize sleep and recovery",
    domain: "Recovery",
    action: "Move sleep toward 7.5-8 hours, raise sleep quality, and reduce pre-bed stimulation.",
    horizon: "30-60 days",
    apply: (input) => ({
      ...input,
      sleep_hours: Math.max(input.sleep_hours, 7.8),
      sleep_quality: Math.max(input.sleep_quality, 8),
      recovery_quality: Math.max(input.recovery_quality ?? 0, 8),
      screen_time_before_bed: "no",
    }),
  },
  {
    id: "cardiorespiratory-capacity",
    title: "Increase cardiorespiratory capacity",
    domain: "Cardiovascular",
    action: "Improve VO2 max, resting heart rate, and HRV through zone 2 plus interval work.",
    horizon: "60-90 days",
    apply: (input) => ({
      ...input,
      resting_hr: input.resting_hr ? Math.min(input.resting_hr, 58) : 58,
      vo2_max: input.vo2_max ? Math.max(input.vo2_max * 1.15, 42) : 42,
      hrv: input.hrv ? Math.max(input.hrv * 1.2, 55) : 55,
      exercise_days: Math.max(input.exercise_days, 5),
    }),
  },
  {
    id: "metabolic-reset",
    title: "Tighten metabolic markers",
    domain: "Metabolic",
    action: "Move glucose, triglycerides, insulin, inflammation, and HDL into a stronger range.",
    horizon: "60-120 days",
    apply: (input) => ({
      ...input,
      fasting_glucose: input.fasting_glucose
        ? Math.min(input.fasting_glucose, 90)
        : 90,
      hba1c: input.hba1c ? Math.min(input.hba1c, 5.2) : 5.2,
      hdl: input.hdl ? Math.max(input.hdl, 60) : 60,
      triglycerides: input.triglycerides
        ? Math.min(input.triglycerides, 100)
        : 100,
      fasting_insulin: input.fasting_insulin
        ? Math.min(input.fasting_insulin, 6)
        : 6,
      hscrp: input.hscrp ? Math.min(input.hscrp, 1) : 1,
    }),
  },
  {
    id: "body-composition",
    title: "Improve body composition",
    domain: "Composition",
    action: "Reduce waist load and excess adiposity while preserving lean tissue.",
    horizon: "90-120 days",
    apply: (input) => ({
      ...input,
      weight_kg: input.weight_kg * 0.94,
      body_fat_pct: input.body_fat_pct
        ? Math.max(input.body_fat_pct * 0.88, 10)
        : input.body_fat_pct,
      waist_cm: input.waist_cm ? Math.max(input.waist_cm - 6, 70) : input.waist_cm,
      strength_training: true,
    }),
  },
  {
    id: "strength-movement",
    title: "Build strength consistency",
    domain: "Movement",
    action: "Lift consistently, raise weekly movement frequency, and make training non-negotiable.",
    horizon: "30-90 days",
    apply: (input) => ({
      ...input,
      exercise_days: Math.max(input.exercise_days, 5),
      strength_training: true,
    }),
  },
  {
    id: "stress-resilience",
    title: "Lower chronic stress load",
    domain: "Neuroendocrine",
    action: "Bring stress and anxiety down while increasing connection, purpose, and recovery capacity.",
    horizon: "30-90 days",
    apply: (input) => ({
      ...input,
      stress_level: Math.min(input.stress_level, 3),
      anxiety_level: input.anxiety_level ? Math.min(input.anxiety_level, 3) : 3,
      social_connection: input.social_connection
        ? Math.max(input.social_connection, 8)
        : 8,
      purpose_score: input.purpose_score ? Math.max(input.purpose_score, 8) : 8,
    }),
  },
];
