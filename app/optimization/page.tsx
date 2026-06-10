"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import PageContainer from "@/components/ui/PageContainer";
import { supabase } from "@/lib/supabase/client";

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

type OptimizationProtocol = {
  summary: string;
  focus_domains: string[];
  primary_protocol: ProtocolAction[];
  weekly_sequence: Array<{
    week: string;
    focus: string;
    actions: string[];
  }>;
  tracking_metrics: Array<{
    metric: string;
    target: string;
    source: string;
  }>;
  coach_message: string;
};

type BioAgeSimulation = {
  id: string;
  title: string;
  domain: string;
  action: string;
  horizon: string;
  projectedAgeDeltaImprovement: number;
  projectedBiologicalAgeImprovement: number;
  projectedBiologicalAge: number;
  projectedScore: number;
  confidence: number;
  keyDrivers: string[];
};

type SimulatorControls = {
  sleep_hours: number;
  vo2_max: number;
  weight_kg: number;
  stress_level: number;
  exercise_days: number;
  resting_hr: number;
};

type SimulatorProjection = {
  chronologicalAge: number;
  biologicalAge: number;
  ageDelta: number;
  score: number;
  accuracyScore: number;
  category: string;
  projectedAgeDeltaImprovement: number;
  projectedBiologicalAgeImprovement: number;
};

const QUESTIONS: Question[] = [
  {
    id: "priority",
    domain: "Priority",
    prompt: "What would create the biggest improvement in your life right now?",
    options: ["More energy", "Deeper sleep", "Better body composition", "Sharper focus"],
  },
  {
    id: "sleep",
    domain: "Sleep",
    prompt: "What usually limits your recovery?",
    options: ["Late bedtime", "Restless sleep", "Early waking", "Inconsistent schedule"],
  },
  {
    id: "nutrition",
    domain: "Nutrition",
    prompt: "Where does nutrition break down most often?",
    options: ["Protein consistency", "Late meals", "Cravings", "Travel or workdays"],
  },
  {
    id: "training",
    domain: "Movement",
    prompt: "Which training pattern best matches your current week?",
    options: ["Mostly walking", "Cardio focused", "Strength focused", "Inconsistent"],
  },
  {
    id: "metabolic",
    domain: "Metabolic",
    prompt: "What metabolic signal do you most want to improve?",
    options: ["Glucose stability", "Waist size", "Triglycerides", "Insulin sensitivity"],
  },
  {
    id: "stress",
    domain: "Stress",
    prompt: "When does stress most affect your decisions?",
    options: ["Morning pressure", "Afternoon crash", "Evening recovery", "Sleep onset"],
  },
  {
    id: "cognitive",
    domain: "Cognitive",
    prompt: "What cognitive state do you want more often?",
    options: ["Calm focus", "Fast recall", "Creative output", "Deep work stamina"],
  },
  {
    id: "constraints",
    domain: "Constraints",
    prompt: "What should Aeonvera optimize around first?",
    options: ["Busy schedule", "Family rhythm", "Travel", "High-performance work"],
  },
];

const IMPACT_WIDTH = {
  high: 92,
  medium: 72,
  low: 54,
};

const SIMULATOR_FIELDS: Array<{
  key: keyof SimulatorControls;
  label: string;
  min: number;
  max: number;
  step: number;
  suffix: string;
}> = [
  { key: "sleep_hours", label: "Sleep", min: 4, max: 10, step: 0.1, suffix: "hrs" },
  { key: "vo2_max", label: "VO2 Max", min: 20, max: 70, step: 1, suffix: "" },
  { key: "weight_kg", label: "Weight", min: 45, max: 180, step: 0.5, suffix: "kg" },
  { key: "stress_level", label: "Stress", min: 1, max: 10, step: 1, suffix: "/10" },
  { key: "exercise_days", label: "Exercise", min: 0, max: 7, step: 1, suffix: "days" },
  { key: "resting_hr", label: "Resting HR", min: 40, max: 100, step: 1, suffix: "bpm" },
];

export default function OptimizationPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [context, setContext] = useState("");
  const [showMap, setShowMap] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [generatingProtocol, setGeneratingProtocol] = useState(false);
  const [protocol, setProtocol] = useState<OptimizationProtocol | null>(null);
  const [protocolMessage, setProtocolMessage] = useState<string | null>(null);
  const [bioAgeSimulations, setBioAgeSimulations] = useState<BioAgeSimulation[]>([]);
  const [simulatorControls, setSimulatorControls] = useState<SimulatorControls | null>(null);
  const [simulatorProjection, setSimulatorProjection] = useState<SimulatorProjection | null>(null);
  const [runningProjection, setRunningProjection] = useState(false);
  const [projectionMessage, setProjectionMessage] = useState<string | null>(null);

  const question = QUESTIONS[step];
  const answeredCount = Object.keys(answers).length;
  const progress = Math.round((answeredCount / QUESTIONS.length) * 100);
  const complete = showMap && answeredCount === QUESTIONS.length;

  useEffect(() => {
    let cancelled = false;

    async function verifyUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (!user) {
        router.replace("/login?mode=signin");
        return;
      }

      fetch("/api/longevity/simulator", { credentials: "include" })
        .then((response) => response.json())
        .then((data) => {
          if (!cancelled && data?.simulations) {
            setBioAgeSimulations(data.simulations);
            setSimulatorControls(data.controls || null);
          }
        })
        .catch(() => null);

      setAuthChecked(true);
    }

    verifyUser();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const focusStack = useMemo(() => {
    const selected = Object.values(answers);
    return [
      selected[0] || "Personal baseline",
      selected[1] || "Recovery rhythm",
      selected[3] || "Training consistency",
    ];
  }, [answers]);

  function selectAnswer(value: string) {
    setAnswers((current) => ({ ...current, [question.id]: value }));
  }

  async function buildOptimizationProtocol(projectionContext?: {
    controls: SimulatorControls;
    projection: SimulatorProjection;
  }) {
    setGeneratingProtocol(true);
    setProtocolMessage(null);

    try {
      const response = await fetch("/api/optimization/protocol", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          answers,
          context,
          questions: QUESTIONS,
          projectionContext,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not build optimization protocol.");
      }

      setProtocol(data.protocol.protocol as OptimizationProtocol);
      setShowMap(true);
    } catch (error) {
      setProtocolMessage(
        error instanceof Error
          ? error.message
          : "Could not build optimization protocol."
      );
    } finally {
      setGeneratingProtocol(false);
    }
  }

  function nextQuestion() {
    if (step === QUESTIONS.length - 1 && answers[question.id]) {
      void buildOptimizationProtocol();
      return;
    }

    if (step < QUESTIONS.length - 1) {
      setStep((current) => current + 1);
    }
  }

  function previousQuestion() {
    if (step > 0) {
      setStep((current) => current - 1);
    }
  }

  async function runProjection(nextControls = simulatorControls) {
    if (!nextControls) return;

    setRunningProjection(true);
    setProjectionMessage(null);

    try {
      const response = await fetch("/api/longevity/simulator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ controls: nextControls }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not run projection.");
      }

      setSimulatorControls(data.controls);
      setSimulatorProjection(data.projection);
    } catch (error) {
      setProjectionMessage(
        error instanceof Error ? error.message : "Could not run projection."
      );
    } finally {
      setRunningProjection(false);
    }
  }

  async function buildProtocolFromProjection() {
    if (!simulatorControls || !simulatorProjection) return;

    await buildOptimizationProtocol({
      controls: simulatorControls,
      projection: simulatorProjection,
    });
  }

  function updateSimulatorControl(key: keyof SimulatorControls, value: number) {
    setSimulatorControls((current) => current ? { ...current, [key]: value } : current);
  }

  if (!authChecked) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6">
        <div className="relative size-12">
          <div className="absolute inset-0 rounded-full border border-white/[0.06]" />
          <div className="absolute inset-0 animate-spin rounded-full border-t royal-border" />
        </div>
        <p className="text-[10px] uppercase tracking-[0.14em] text-white/25">
          Loading optimization
        </p>
      </div>
    );
  }

  return (
    <PageContainer>
      <div className="py-16">
        <div className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="micro-label mb-5">Optimization</p>
            <h1 className="max-w-4xl text-5xl font-light leading-[1.04] text-white md:text-6xl">
              Build the operating system for your healthspan.
            </h1>
            <p className="mt-6 max-w-2xl text-sm leading-7 text-white/50">
              Aeonvera asks across the major human performance domains, then
              turns your answers into a precise optimization map.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-white/45 transition hover:text-white/80"
          >
            Dashboard
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
          <div className="hero-stage relative overflow-hidden rounded-xl border border-white/10 p-6 md:p-7">
            <div className="relative z-10 flex h-full min-h-[34rem] flex-col">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-white">Optimization signal</p>
                  <p className="mt-1 text-sm text-white/50">Continuity from your healthspan overview</p>
                </div>
                <div className="premium-status rounded-md px-3 py-1 text-sm font-medium text-white/70">
                  {progress}%
                </div>
              </div>

              <div className="mt-9 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
                <VitalSignalClock />
                <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-5">
                  <div className="living-dashboard-pulse mb-5 flex size-14 items-center justify-center rounded-lg">
                    <HeartbeatMonitor />
                  </div>
                  <p className="micro-label">Current focus</p>
                  <div className="mt-4 space-y-3">
                    {focusStack.map((item) => (
                      <div key={item} className="flex items-center gap-3 text-sm text-white/60">
                        <div className="h-1.5 w-1.5 rounded-full bg-white/40" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-auto grid gap-3 pt-7 sm:grid-cols-3">
                {[
                  ["Questions", `${answeredCount}/${QUESTIONS.length}`],
                  ["Domains", "12"],
                  ["Mode", complete ? "Map" : "Intake"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-white/[0.06] bg-white/[0.035] p-4">
                    <p className="text-sm text-white/40">{label}</p>
                    <p className="mt-2 text-2xl font-light text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="executive-panel rounded-lg p-6 md:p-7">
            <div className="mb-6 flex items-center justify-between gap-4 border-b border-white/[0.06] pb-5">
              <div>
                <p className="micro-label">{question.domain}</p>
                <h2 className="mt-3 text-3xl font-light text-white md:text-4xl">
                  {complete ? "Optimization map" : question.prompt}
                </h2>
              </div>
              <div className="premium-status rounded-md px-3 py-1.5 text-xs font-medium">
                Step {Math.min(step + 1, QUESTIONS.length)}
              </div>
            </div>

            {!complete ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {question.options.map((option) => {
                    const selected = answers[question.id] === option;

                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => selectAnswer(option)}
                        className={`quiet-lift rounded-lg border p-4 text-left transition ${
                          selected
                            ? "border-white/[0.18] bg-white/[0.07]"
                            : "border-white/[0.07] bg-white/[0.025]"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border ${
                            selected ? "border-white/35 bg-white/10" : "border-white/[0.12]"
                          }`}>
                            {selected && <Check size={13} />}
                          </div>
                          <span className="text-sm leading-6 text-white/68">{option}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6">
                  <label className="micro-label" htmlFor="optimization-context">
                    Additional context
                  </label>
                  <textarea
                    id="optimization-context"
                    value={context}
                    onChange={(event) => setContext(event.target.value)}
                    className="mt-3 min-h-28 w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.025] p-4 text-sm leading-6 text-white/70 outline-none transition focus:border-white/[0.18] focus:bg-white/[0.04]"
                    placeholder="Constraints, goals, labs, travel, injuries, family rhythm, or anything the optimizer should respect."
                  />
                </div>

                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-between">
                  <button
                    type="button"
                    onClick={previousQuestion}
                    disabled={step === 0}
                    className="premium-action-secondary inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={nextQuestion}
                    disabled={!answers[question.id] || generatingProtocol}
                    className="premium-action inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {generatingProtocol
                      ? "Building map"
                      : step === QUESTIONS.length - 1
                      ? "Build map"
                      : "Next question"}
                    <ArrowRight size={16} />
                  </button>
                </div>

                {protocolMessage && (
                  <p className="mt-4 rounded-lg border border-white/[0.08] bg-white/[0.025] p-4 text-sm leading-6 text-white/55">
                    {protocolMessage}
                  </p>
                )}
              </>
            ) : (
              <div className="space-y-5">
                <div className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-5">
                  <div className="flex items-center gap-3">
                    <div className="premium-status flex size-10 items-center justify-center rounded-lg">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white/80">Optimization protocol is ready</p>
                      <p className="mt-1 text-xs leading-5 text-white/40">
                        {protocol?.coach_message || protocol?.summary || "Aeonvera generated your first adaptive optimization protocol."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {(protocol?.primary_protocol || []).map((item, index) => (
                    <div key={`${item.domain}-${item.action}`} className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm text-white/68">{item.domain}</p>
                        <span className="text-[10px] uppercase tracking-[0.14em] text-white/28">
                          {item.impact}
                        </span>
                      </div>
                      <p className="mb-3 text-xs leading-5 text-white/42">{item.action}</p>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="living-bar h-full rounded-full"
                          style={{ width: `${IMPACT_WIDTH[item.impact] - index * 2}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {protocol?.weekly_sequence?.length ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {protocol.weekly_sequence.slice(0, 3).map((sequence) => (
                      <div key={sequence.week} className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-4">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-white/28">
                          {sequence.week}
                        </p>
                        <p className="mt-2 text-sm font-medium text-white/70">
                          {sequence.focus}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}

                {protocol?.tracking_metrics?.length ? (
                  <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-4">
                    <p className="micro-label">Tracking</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {protocol.tracking_metrics.slice(0, 4).map((metric) => (
                        <div key={metric.metric}>
                          <p className="text-sm text-white/68">{metric.metric}</p>
                          <p className="mt-1 text-xs leading-5 text-white/38">
                            {metric.target}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    setStep(0);
                    setAnswers({});
                    setContext("");
                    setShowMap(false);
                    setProtocol(null);
                    setProtocolMessage(null);
                  }}
                  className="premium-action-secondary inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-medium"
                >
                  Restart intake
                </button>
              </div>
            )}
          </div>
        </div>

        {bioAgeSimulations.length > 0 && (
          <div className="mt-6 executive-panel rounded-lg p-6 md:p-7">
            <div className="mb-6 flex flex-col gap-3 border-b border-white/[0.06] pb-5 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="micro-label">Biological age levers</p>
                <h2 className="mt-3 text-3xl font-light text-white">
                  Highest-impact changes from your current baseline.
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-6 text-white/38">
                These projections use the same engine as your biological age score.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {bioAgeSimulations.slice(0, 3).map((simulation, index) => (
                <div
                  key={simulation.id}
                  className="quiet-lift rounded-lg border border-white/[0.07] bg-white/[0.025] p-5"
                >
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <span className="royal-text text-sm tabular-nums">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[9px] uppercase tracking-[0.14em] text-white/25">
                      {simulation.domain}
                    </span>
                  </div>
                  <p className="text-lg font-light leading-7 text-white/80">
                    {simulation.title}
                  </p>
                  <p className="mt-3 min-h-20 text-sm leading-7 text-white/42">
                    {simulation.action}
                  </p>
                  <div className="mt-5 flex items-end justify-between border-t border-white/[0.06] pt-4">
                    <div>
                      <p className="text-[9px] uppercase tracking-[0.14em] text-white/22">
                        Potential
                      </p>
                      <p className="mt-1 text-2xl font-light royal-text">
                        {simulation.projectedAgeDeltaImprovement.toFixed(1)}
                      </p>
                    </div>
                    <p className="text-xs text-white/34">{simulation.horizon}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {simulatorControls && (
          <div className="mt-6 executive-panel rounded-lg p-6 md:p-7">
            <div className="mb-6 flex flex-col gap-3 border-b border-white/[0.06] pb-5 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="micro-label">Future self simulator</p>
                <h2 className="mt-3 text-3xl font-light text-white">
                  Adjust the levers and project the biological-age shift.
                </h2>
              </div>
              <button
                type="button"
                onClick={() => void runProjection()}
                disabled={runningProjection}
                className="premium-action inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
              >
                {runningProjection ? "Projecting" : "Run projection"}
              </button>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="grid gap-4 sm:grid-cols-2">
                {SIMULATOR_FIELDS.map((field) => (
                  <div key={field.key} className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm text-white/64">{field.label}</p>
                      <span className="text-sm royal-text">
                        {simulatorControls[field.key]}
                        {field.suffix ? ` ${field.suffix}` : ""}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      value={simulatorControls[field.key]}
                      onChange={(event) =>
                        updateSimulatorControl(field.key, Number(event.target.value))
                      }
                      className="w-full accent-[#dabc73]"
                    />
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-5">
                <p className="micro-label mb-5">Projection result</p>
                {simulatorProjection ? (
                  <>
                    <div className="flex items-end gap-3">
                      <p className="text-6xl font-light leading-none text-white/88">
                        {simulatorProjection.biologicalAge}
                      </p>
                      <p className="mb-1 text-sm uppercase tracking-[0.14em] text-white/24">
                        yrs projected
                      </p>
                    </div>
                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-4">
                        <p className="text-[9px] uppercase tracking-[0.14em] text-white/24">
                          Improvement
                        </p>
                        <p className="mt-2 text-2xl font-light royal-text">
                          {simulatorProjection.projectedAgeDeltaImprovement.toFixed(1)} yrs
                        </p>
                      </div>
                      <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-4">
                        <p className="text-[9px] uppercase tracking-[0.14em] text-white/24">
                          Score
                        </p>
                        <p className="mt-2 text-2xl font-light text-white/72">
                          {simulatorProjection.score}
                        </p>
                      </div>
                    </div>
                    <p className="mt-5 text-sm leading-7 text-white/42">
                      This is a deterministic projection from your current assessment, not a medical diagnosis.
                    </p>
                    <button
                      type="button"
                      onClick={() => void buildProtocolFromProjection()}
                      disabled={generatingProtocol}
                      className="premium-action mt-5 inline-flex h-11 w-full items-center justify-center rounded-md px-5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {generatingProtocol ? "Building protocol" : "Build protocol from projection"}
                    </button>
                  </>
                ) : (
                  <p className="text-sm leading-7 text-white/42">
                    Move the controls, then run a projection to see the estimated biological-age trajectory.
                  </p>
                )}
                {projectionMessage && (
                  <p className="mt-4 rounded-lg border border-white/[0.08] bg-white/[0.025] p-4 text-sm leading-6 text-white/55">
                    {projectionMessage}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}

function VitalSignalClock() {
  return (
    <div className="age-signal" aria-hidden="true">
      <div className="age-signal__halo" />
      <svg viewBox="20 20 120 120">
        <defs>
          <linearGradient id="optimization-age-signal-gradient" x1="36" y1="28" x2="124" y2="132" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="rgba(248,250,252,0.94)" />
            <stop offset="48%" stopColor="rgba(164, 195, 255, 0.82)" />
            <stop offset="74%" stopColor="rgba(218, 188, 115, 0.78)" />
            <stop offset="100%" stopColor="rgba(248,250,252,0.9)" />
          </linearGradient>
        </defs>
        <circle className="age-signal__track" cx="80" cy="80" r="58" />
        <circle className="age-signal__progress optimization-age-signal__progress" cx="80" cy="80" r="58" />
        <circle className="age-signal__inner" cx="80" cy="80" r="34" />
        <path className="age-signal__wave" pathLength={100} d="M34 83 H55 L63 72 L74 94 L86 65 L98 83 H126" />
        <line className="age-signal__hand" x1="80" y1="80" x2="80" y2="34" />
        <path className="age-signal__scan" d="M80 28 A52 52 0 0 1 132 80" />
        <circle className="age-signal__dot" cx="122" cy="48" r="3.2" />
      </svg>
    </div>
  );
}

function HeartbeatMonitor() {
  return (
    <svg
      className="dashboard-heartbeat-monitor optimization-heartbeat-monitor"
      viewBox="0 0 64 40"
      aria-hidden="true"
    >
      <defs>
        <filter id="optimization-heartbeat-light-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        className="dashboard-heartbeat-monitor__line"
        pathLength={100}
        d="M4 22 H20 L25 13 L32 30 L39 9 L45 22 H60"
      />
      <path
        className="dashboard-heartbeat-monitor__trace dashboard-heartbeat-monitor__trace--halo"
        pathLength={100}
        filter="url(#optimization-heartbeat-light-glow)"
        style={{ "--heartbeat-duration": "2.2s" } as CSSProperties}
        d="M4 22 H20 L25 13 L32 30 L39 9 L45 22 H60"
      />
      <path
        className="dashboard-heartbeat-monitor__trace dashboard-heartbeat-monitor__trace--core"
        pathLength={100}
        style={{ "--heartbeat-duration": "2.2s" } as CSSProperties}
        d="M4 22 H20 L25 13 L32 30 L39 9 L45 22 H60"
      />
    </svg>
  );
}
