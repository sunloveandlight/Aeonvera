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

type SimulatorControls = {
  sleep_hours: number;
  vo2_max: number;
  weight_kg: number;
  stress_level: number;
  exercise_days: number;
  resting_hr: number;
};

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
    const input = await getLatestAssessmentInput();
    const baseline = computeBiologicalAge(input);
    const simulations = SCENARIOS.map((scenario) =>
      buildSimulation(scenario, baseline, input)
    )
      .sort((a, b) => b.projectedAgeDeltaImprovement - a.projectedAgeDeltaImprovement)
      .slice(0, 5);

    return NextResponse.json({
      baseline: summarizeResult(baseline),
      controls: buildControls(input),
      simulations,
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
    const input = await getLatestAssessmentInput();
    const baseline = computeBiologicalAge(input);
    const body = await readJsonBody(request);
    const controls = normalizeControls(body?.controls, buildControls(input));
    const projected = computeBiologicalAge({
      ...input,
      sleep_hours: controls.sleep_hours,
      vo2_max: controls.vo2_max,
      weight_kg: controls.weight_kg,
      stress_level: controls.stress_level,
      exercise_days: controls.exercise_days,
      resting_hr: controls.resting_hr,
    });

    return NextResponse.json({
      baseline: summarizeResult(baseline),
      controls,
      projection: {
        ...summarizeResult(projected),
        projectedAgeDeltaImprovement: Number(
          (baseline.ageDelta - projected.ageDelta).toFixed(1)
        ),
        projectedBiologicalAgeImprovement: Number(
          (baseline.biologicalAge - projected.biologicalAge).toFixed(1)
        ),
      },
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

async function getLatestAssessmentInput() {
  const supabaseUser = await getSupabaseUser();
  const { data: { user }, error: userError } = await supabaseUser.auth.getUser();

  if (userError || !user) {
    throw new SimulatorError("Unauthorized", 401);
  }

  const supabase = getSupabaseAdmin();
  const { data: assessment, error: assessmentError } = await supabase
    .from("longevity_assessments")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (assessmentError || !assessment) {
    throw new SimulatorError("No assessment found.", 404);
  }

  return buildAssessmentInput(assessment);
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
  return {
    sleep_hours: clamp(round(input.sleep_hours, 1), 4, 10),
    vo2_max: clamp(round(input.vo2_max ?? 40, 1), 20, 70),
    weight_kg: clamp(round(input.weight_kg, 1), 45, 180),
    stress_level: clamp(round(input.stress_level, 0), 1, 10),
    exercise_days: clamp(round(input.exercise_days, 0), 0, 7),
    resting_hr: clamp(round(input.resting_hr ?? 65, 0), 40, 100),
  };
}

function normalizeControls(
  value: unknown,
  fallback: SimulatorControls
): SimulatorControls {
  const controls = typeof value === "object" && value !== null
    ? (value as Partial<Record<keyof SimulatorControls, unknown>>)
    : {};

  return {
    sleep_hours: clamp(numberOr(controls.sleep_hours, fallback.sleep_hours), 4, 10),
    vo2_max: clamp(numberOr(controls.vo2_max, fallback.vo2_max), 20, 70),
    weight_kg: clamp(numberOr(controls.weight_kg, fallback.weight_kg), 45, 180),
    stress_level: clamp(numberOr(controls.stress_level, fallback.stress_level), 1, 10),
    exercise_days: clamp(numberOr(controls.exercise_days, fallback.exercise_days), 0, 7),
    resting_hr: clamp(numberOr(controls.resting_hr, fallback.resting_hr), 40, 100),
  };
}

async function readJsonBody(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function numberOr(value: unknown, fallback: number) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
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
