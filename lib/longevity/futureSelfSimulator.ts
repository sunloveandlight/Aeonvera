import type {
  AssessmentInput,
  BiologicalAgeResult,
} from "@/lib/longevity/biologicalAgeEngine";
import { computeBiologicalAge } from "@/lib/longevity/biologicalAgeEngine";

export type FutureSelfControls = {
  sleep_hours: number;
  vo2_max: number;
  weight_kg: number;
  stress_level: number;
  exercise_days: number;
  resting_hr: number;
};

export type FutureSelfTrajectoryPoint = {
  day: number;
  currentBiologicalAge: number;
  optimizedBiologicalAge: number;
  gap: number;
};

export type FutureSelfLever = {
  key: keyof FutureSelfControls;
  label: string;
  current: number;
  optimized: number;
  delta: number;
  impact: "low" | "medium" | "high";
  direction: "increase" | "decrease";
};

export type FutureSelfScenario = {
  id: string;
  title: string;
  domain: string;
  description: string;
  horizon: string;
  apply: (controls: FutureSelfControls) => FutureSelfControls;
};

export type FutureSelfProjection = {
  baseline: ReturnType<typeof summarizeResult>;
  optimized: ReturnType<typeof summarizeResult> & {
    projectedAgeDeltaImprovement: number;
    projectedBiologicalAgeImprovement: number;
  };
  currentTrajectory: FutureSelfTrajectoryPoint[];
  optimizedTrajectory: FutureSelfTrajectoryPoint[];
  trajectory: FutureSelfTrajectoryPoint[];
  levers: FutureSelfLever[];
  headline: string;
  summary: string;
  horizonDays: number;
  activeScenarios: Array<Omit<FutureSelfScenario, "apply">>;
};

const HORIZON_DAYS = [0, 30, 60, 90, 180];

export const FUTURE_SELF_SCENARIOS: FutureSelfScenario[] = [
  {
    id: "lose-20-pounds",
    title: "Lose 20 pounds",
    domain: "Composition",
    description: "Project the biological-age effect of reducing body mass while keeping strength work active.",
    horizon: "90-180 days",
    apply: (controls) => ({
      ...controls,
      weight_kg: clamp(round(controls.weight_kg - 9.1, 1), 45, 180),
      exercise_days: Math.max(controls.exercise_days, 4),
    }),
  },
  {
    id: "vo2-15",
    title: "Improve VO2 max 15%",
    domain: "Cardiovascular",
    description: "Model a focused aerobic block that lifts cardiorespiratory capacity.",
    horizon: "60-120 days",
    apply: (controls) => ({
      ...controls,
      vo2_max: clamp(round(controls.vo2_max * 1.15, 1), 20, 70),
      resting_hr: clamp(round(controls.resting_hr - 3, 0), 40, 100),
      exercise_days: Math.max(controls.exercise_days, 5),
    }),
  },
  {
    id: "sleep-30",
    title: "Sleep 30 more minutes",
    domain: "Recovery",
    description: "Add half an hour of sleep opportunity and project the recovery effect.",
    horizon: "30-60 days",
    apply: (controls) => ({
      ...controls,
      sleep_hours: clamp(round(controls.sleep_hours + 0.5, 1), 4, 10),
      stress_level: clamp(round(controls.stress_level - 1, 0), 1, 10),
    }),
  },
  {
    id: "stress-reset",
    title: "Lower stress two points",
    domain: "Neuroendocrine",
    description: "Simulate a sustained recovery protocol that lowers chronic stress load.",
    horizon: "30-90 days",
    apply: (controls) => ({
      ...controls,
      stress_level: clamp(round(controls.stress_level - 2, 0), 1, 10),
      resting_hr: clamp(round(controls.resting_hr - 2, 0), 40, 100),
    }),
  },
  {
    id: "training-consistency",
    title: "Train five days weekly",
    domain: "Movement",
    description: "Project a consistent weekly rhythm of strength and aerobic training.",
    horizon: "60-120 days",
    apply: (controls) => ({
      ...controls,
      exercise_days: Math.max(controls.exercise_days, 5),
      vo2_max: clamp(round(controls.vo2_max * 1.08, 1), 20, 70),
    }),
  },
];

export function buildDefaultFutureSelfControls(input: AssessmentInput): FutureSelfControls {
  return {
    sleep_hours: clamp(round(input.sleep_hours, 1), 4, 10),
    vo2_max: clamp(round(input.vo2_max ?? 40, 1), 20, 70),
    weight_kg: clamp(round(input.weight_kg, 1), 45, 180),
    stress_level: clamp(round(input.stress_level, 0), 1, 10),
    exercise_days: clamp(round(input.exercise_days, 0), 0, 7),
    resting_hr: clamp(round(input.resting_hr ?? 65, 0), 40, 100),
  };
}

export function normalizeFutureSelfControls(
  value: unknown,
  fallback: FutureSelfControls
): FutureSelfControls {
  const controls = typeof value === "object" && value !== null
    ? (value as Partial<Record<keyof FutureSelfControls, unknown>>)
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

export function applyFutureSelfScenarios(
  controls: FutureSelfControls,
  scenarioIds: string[]
) {
  const scenarioMap = new Map(FUTURE_SELF_SCENARIOS.map((scenario) => [scenario.id, scenario]));

  return scenarioIds.reduce((nextControls, scenarioId) => {
    const scenario = scenarioMap.get(scenarioId);
    return scenario ? scenario.apply(nextControls) : nextControls;
  }, controls);
}

export function summarizeFutureSelfScenarios(scenarioIds: string[]) {
  const ids = new Set(scenarioIds);
  return FUTURE_SELF_SCENARIOS.filter((scenario) => ids.has(scenario.id)).map(
    scenarioSummary
  );
}

export function buildFutureSelfProjection({
  input,
  controls,
  horizonDays = 180,
  activeScenarioIds = [],
}: {
  input: AssessmentInput;
  controls: FutureSelfControls;
  horizonDays?: number;
  activeScenarioIds?: string[];
}): FutureSelfProjection {
  const baseline = computeBiologicalAge(input);
  const optimized = computeBiologicalAge(applyFutureSelfControls(input, controls));
  const projectedAgeDeltaImprovement = round(baseline.ageDelta - optimized.ageDelta, 1);
  const projectedBiologicalAgeImprovement = round(
    baseline.biologicalAge - optimized.biologicalAge,
    1
  );
  const currentTrajectory = buildTrajectory({
    baseline,
    target: baseline,
    horizonDays,
    mode: "current",
  });
  const optimizedTrajectory = buildTrajectory({
    baseline,
    target: optimized,
    horizonDays,
    mode: "optimized",
  });
  const trajectory = HORIZON_DAYS.map((day, index) => ({
    day,
    currentBiologicalAge: currentTrajectory[index].currentBiologicalAge,
    optimizedBiologicalAge: optimizedTrajectory[index].optimizedBiologicalAge,
    gap: round(
      currentTrajectory[index].currentBiologicalAge -
        optimizedTrajectory[index].optimizedBiologicalAge,
      1
    ),
  }));
  const levers = buildLevers(input, controls);

  return {
    baseline: summarizeResult(baseline),
    optimized: {
      ...summarizeResult(optimized),
      projectedAgeDeltaImprovement,
      projectedBiologicalAgeImprovement,
    },
    currentTrajectory,
    optimizedTrajectory,
    trajectory,
    levers,
    headline:
      projectedBiologicalAgeImprovement > 0
        ? `Optimized trajectory is ${projectedBiologicalAgeImprovement.toFixed(1)} years younger.`
        : "Current and optimized trajectories are currently close.",
    summary: buildSummary({ projectedBiologicalAgeImprovement, levers }),
    horizonDays,
    activeScenarios: summarizeFutureSelfScenarios(activeScenarioIds),
  };
}

export function applyFutureSelfControls(
  input: AssessmentInput,
  controls: FutureSelfControls
): AssessmentInput {
  return {
    ...input,
    sleep_hours: controls.sleep_hours,
    vo2_max: controls.vo2_max,
    weight_kg: controls.weight_kg,
    stress_level: controls.stress_level,
    exercise_days: controls.exercise_days,
    resting_hr: controls.resting_hr,
  };
}

function buildTrajectory({
  baseline,
  target,
  horizonDays,
  mode,
}: {
  baseline: BiologicalAgeResult;
  target: BiologicalAgeResult;
  horizonDays: number;
  mode: "current" | "optimized";
}) {
  const drift = mode === "current" ? currentTrajectoryDrift(baseline) : 0;
  const totalChange =
    mode === "current"
      ? drift
      : target.biologicalAge - baseline.biologicalAge;

  return HORIZON_DAYS.map((day) => {
    const progress = Math.min(1, day / horizonDays);
    const eased = easeOut(progress);
    const optimizedAge = round(baseline.biologicalAge + totalChange * eased, 1);
    const currentAge = round(baseline.biologicalAge + drift * progress, 1);

    return {
      day,
      currentBiologicalAge: mode === "current" ? currentAge : baseline.biologicalAge,
      optimizedBiologicalAge: mode === "optimized" ? optimizedAge : baseline.biologicalAge,
      gap: round(currentAge - optimizedAge, 1),
    };
  });
}

function buildLevers(input: AssessmentInput, controls: FutureSelfControls): FutureSelfLever[] {
  const current = buildDefaultFutureSelfControls(input);

  return [
    buildLever("sleep_hours", "Sleep", current.sleep_hours, controls.sleep_hours, "increase"),
    buildLever("vo2_max", "VO2 Max", current.vo2_max, controls.vo2_max, "increase"),
    buildLever("weight_kg", "Weight", current.weight_kg, controls.weight_kg, "decrease"),
    buildLever("stress_level", "Stress", current.stress_level, controls.stress_level, "decrease"),
    buildLever("exercise_days", "Exercise", current.exercise_days, controls.exercise_days, "increase"),
    buildLever("resting_hr", "Resting HR", current.resting_hr, controls.resting_hr, "decrease"),
  ]
    .filter((lever) => Math.abs(lever.delta) > 0.01)
    .sort((a, b) => impactScore(b.impact) - impactScore(a.impact));
}

function buildLever(
  key: keyof FutureSelfControls,
  label: string,
  current: number,
  optimized: number,
  direction: FutureSelfLever["direction"]
): FutureSelfLever {
  const rawDelta = round(optimized - current, 1);
  const favorableMagnitude =
    direction === "increase" ? rawDelta : -rawDelta;
  const abs = Math.abs(favorableMagnitude);

  return {
    key,
    label,
    current,
    optimized,
    delta: rawDelta,
    direction,
    impact: abs >= 8 || (key === "sleep_hours" && abs >= 0.8) || (key === "exercise_days" && abs >= 2)
      ? "high"
      : abs >= 3 || (key === "sleep_hours" && abs >= 0.3) || (key === "exercise_days" && abs >= 1)
      ? "medium"
      : "low",
  };
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

function currentTrajectoryDrift(result: BiologicalAgeResult) {
  if (result.ageDelta > 3) return 0.8;
  if (result.ageDelta > 1) return 0.4;
  if (result.ageDelta < -2) return -0.2;
  return 0.1;
}

function buildSummary({
  projectedBiologicalAgeImprovement,
  levers,
}: {
  projectedBiologicalAgeImprovement: number;
  levers: FutureSelfLever[];
}) {
  const top = levers[0];

  if (!top) {
    return "Your current settings already sit close to the optimized model. Move a lever to compare a stronger future-self path.";
  }

  return `The strongest lever is ${top.label.toLowerCase()}. This projection estimates ${projectedBiologicalAgeImprovement.toFixed(1)} years of biological-age separation over the model horizon.`;
}

function easeOut(value: number) {
  return 1 - (1 - value) ** 2;
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

function impactScore(value: FutureSelfLever["impact"]) {
  return value === "high" ? 3 : value === "medium" ? 2 : 1;
}

function scenarioSummary(scenario: FutureSelfScenario) {
  return {
    id: scenario.id,
    title: scenario.title,
    domain: scenario.domain,
    description: scenario.description,
    horizon: scenario.horizon,
  };
}
