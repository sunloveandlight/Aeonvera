"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import PageContainer from "@/components/ui/PageContainer";
import AccessState, { EmptyState } from "@/components/ui/AccessState";
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

type FutureSelfProjection = {
  baseline: {
    chronologicalAge: number;
    biologicalAge: number;
    ageDelta: number;
    score: number;
    accuracyScore: number;
    category: string;
  };
  optimized: SimulatorProjection;
  trajectory: Array<{
    day: number;
    currentBiologicalAge: number;
    optimizedBiologicalAge: number;
    gap: number;
  }>;
  levers: Array<{
    key: keyof SimulatorControls;
    label: string;
    current: number;
    optimized: number;
    delta: number;
    impact: "low" | "medium" | "high";
    direction: "increase" | "decrease";
  }>;
  headline: string;
  summary: string;
  horizonDays: number;
  activeScenarios?: ScenarioPreset[];
};

type ScenarioPreset = {
  id: string;
  title: string;
  domain: string;
  description: string;
  horizon: string;
};

type SavedFutureSelfScenario = {
  id: string;
  title: string;
  description: string | null;
  scenario_ids: string[];
  projection?: {
    biologicalAge?: number;
    score?: number;
    projectedBiologicalAgeImprovement?: number;
    projectedAgeDeltaImprovement?: number;
  };
  future_self?: {
    headline?: string;
    summary?: string;
    optimized?: {
      biologicalAge?: number;
      score?: number;
      projectedBiologicalAgeImprovement?: number;
    };
  };
  share_token: string;
  is_public: boolean;
  parent_scenario_id?: string | null;
  version_number?: number | null;
  protocol_id?: string | null;
  created_at: string;
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
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [context, setContext] = useState("");
  const [showMap, setShowMap] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [generatingProtocol, setGeneratingProtocol] = useState(false);
  const [protocol, setProtocol] = useState<OptimizationProtocol | null>(null);
  const [protocolMessage, setProtocolMessage] = useState<string | null>(null);
  const [bioAgeSimulations, setBioAgeSimulations] = useState<BioAgeSimulation[]>([]);
  const [simulatorControls, setSimulatorControls] = useState<SimulatorControls | null>(null);
  const [baseSimulatorControls, setBaseSimulatorControls] = useState<SimulatorControls | null>(null);
  const [simulatorProjection, setSimulatorProjection] = useState<SimulatorProjection | null>(null);
  const [futureSelf, setFutureSelf] = useState<FutureSelfProjection | null>(null);
  const [scenarioPresets, setScenarioPresets] = useState<ScenarioPreset[]>([]);
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<string[]>([]);
  const [savedScenarios, setSavedScenarios] = useState<SavedFutureSelfScenario[]>([]);
  const [comparisonScenarioIds, setComparisonScenarioIds] = useState<string[]>([]);
  const [savingScenario, setSavingScenario] = useState(false);
  const [saveScenarioMessage, setSaveScenarioMessage] = useState<string | null>(null);
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
        setSignedOut(true);
        setAuthChecked(true);
        return;
      }

      fetch("/api/longevity/simulator", { credentials: "include" })
        .then((response) => response.json())
        .then((data) => {
          if (!cancelled && data?.simulations) {
            setBioAgeSimulations(data.simulations);
            setSimulatorControls(data.controls || null);
            setBaseSimulatorControls(data.controls || null);
            setFutureSelf(data.futureSelf || null);
            setScenarioPresets(data.scenarioPresets || []);
          }
        })
        .catch(() => null);

      fetch("/api/longevity/future-self/scenarios", { credentials: "include" })
        .then((response) => response.json())
        .then((data) => {
          if (!cancelled) {
            if (Array.isArray(data?.scenarios)) {
              setSavedScenarios(data.scenarios);
            }

            if (data?.migrationRequired) {
              setSaveScenarioMessage(data.message);
            }
          }
        })
        .catch(() => null);

      setAuthChecked(true);
    }

    verifyUser();

    return () => {
      cancelled = true;
    };
  }, []);

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

  async function runProjection(nextControls = baseSimulatorControls || simulatorControls) {
    if (!nextControls) return;

    setRunningProjection(true);
    setProjectionMessage(null);

    try {
      const response = await fetch("/api/longevity/simulator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          controls: nextControls,
          scenarioIds: selectedScenarioIds,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not run projection.");
      }

      setSimulatorControls(data.controls);
      setSimulatorProjection(data.projection);
      setFutureSelf(data.futureSelf || null);
      setScenarioPresets(data.scenarioPresets || scenarioPresets);
    } catch (error) {
      setProjectionMessage(
        error instanceof Error ? error.message : "Could not run projection."
      );
    } finally {
      setRunningProjection(false);
    }
  }

  async function buildProtocolFromProjection() {
    const projection = simulatorProjection || futureSelf?.optimized || null;
    if (!simulatorControls || !projection) return;

    await buildOptimizationProtocol({
      controls: simulatorControls,
      projection,
    });
  }

  async function saveFutureSelfScenario() {
    const projection = simulatorProjection || futureSelf?.optimized || null;
    if (!simulatorControls || !futureSelf || !projection) return;

    setSavingScenario(true);
    setSaveScenarioMessage(null);

    const activeTitles = scenarioPresets
      .filter((scenario) => selectedScenarioIds.includes(scenario.id))
      .map((scenario) => scenario.title);
    const latestScenario = savedScenarios[0] || null;
    const versionNumber = latestScenario
      ? Math.max(...savedScenarios.map((scenario) => scenario.version_number || 1)) + 1
      : 1;

    try {
      const response = await fetch("/api/longevity/future-self/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: activeTitles.length
            ? activeTitles.slice(0, 3).join(" + ")
            : "My 180-day optimized self",
          description: futureSelf.summary,
          scenarioIds: selectedScenarioIds,
          controls: simulatorControls,
          projection,
          futureSelf,
          isPublic: true,
          parentScenarioId:
            latestScenario?.parent_scenario_id || latestScenario?.id || null,
          versionNumber,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not save scenario.");
      }

      setSavedScenarios((current) => [
        data.scenario,
        ...current.filter((scenario) => scenario.id !== data.scenario.id),
      ]);
      setSaveScenarioMessage("Saved. Your shareable future-self page is ready.");
    } catch (error) {
      setSaveScenarioMessage(
        error instanceof Error ? error.message : "Could not save scenario."
      );
    } finally {
      setSavingScenario(false);
    }
  }

  function updateSimulatorControl(key: keyof SimulatorControls, value: number) {
    setSimulatorControls((current) => current ? { ...current, [key]: value } : current);
    setBaseSimulatorControls((current) => current ? { ...current, [key]: value } : current);
  }

  function toggleScenario(scenarioId: string) {
    setSelectedScenarioIds((current) =>
      current.includes(scenarioId)
        ? current.filter((id) => id !== scenarioId)
        : [...current, scenarioId]
    );
  }

  function toggleComparisonScenario(scenarioId: string) {
    setComparisonScenarioIds((current) => {
      if (current.includes(scenarioId)) {
        return current.filter((id) => id !== scenarioId);
      }

      return [...current.slice(-1), scenarioId];
    });
  }

  if (!authChecked) {
    return (
      <PageContainer>
        <main className="py-14">
          <AccessState
            eyebrow="Optimization"
            title="Preparing your private intake."
            body="Aeonvera is checking your account before opening advanced optimization."
            actions={[{ href: "/pricing", label: "View tiers", variant: "secondary" }]}
          />
        </main>
      </PageContainer>
    );
  }

  if (signedOut) {
    return (
      <PageContainer>
        <main className="py-14">
          <AccessState
            eyebrow="Optimization"
            title="Sign in to build a personal protocol."
            body="Optimization uses your answers, health state, protocols, and model history, so it only runs inside your secure account."
            points={[
              "Advanced AI intake",
              "Personal optimization protocol",
              "Future-self projection",
            ]}
            actions={[
              { href: "/login?mode=signin", label: "Sign in" },
              { href: "/pricing", label: "Compare tiers", variant: "secondary" },
            ]}
          />
        </main>
      </PageContainer>
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
                  <div key={label} className="flex min-h-[5.75rem] flex-col justify-between rounded-lg border border-white/[0.06] bg-white/[0.035] p-4">
                    <p className="text-sm text-white/40">{label}</p>
                    <p className="tabular-nums text-2xl font-light leading-none text-white">{value}</p>
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
                      <p className="mb-3 text-[11px] leading-5 text-[#dabc73]/70">
                        Why Aeonvera recommends this: {item.why}
                      </p>
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

        {futureSelf && (
          <FutureSelfComparisonPanel
            futureSelf={futureSelf}
            onBuildProtocol={() => void buildProtocolFromProjection()}
            onSaveScenario={() => void saveFutureSelfScenario()}
            buildingProtocol={generatingProtocol}
            savingScenario={savingScenario}
            saveMessage={saveScenarioMessage}
          />
        )}

        {scenarioPresets.length > 0 && simulatorControls && (
          <ScenarioStackPanel
            scenarios={scenarioPresets}
            selectedScenarioIds={selectedScenarioIds}
            runningProjection={runningProjection}
            onToggleScenario={toggleScenario}
            onRunProjection={() => void runProjection()}
          />
        )}

        {(savedScenarios.length > 0 || saveScenarioMessage) && (
          <SavedFutureSelfScenariosPanel
            scenarios={savedScenarios}
            message={saveScenarioMessage}
            comparisonScenarioIds={comparisonScenarioIds}
            onToggleComparison={toggleComparisonScenario}
          />
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
                  <EmptyState
                    eyebrow="Projection ready"
                    title="Adjust the levers to simulate your future self."
                    body="Aeonvera will estimate the biological-age shift from your current assessment and health-state baseline."
                  />
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

function FutureSelfComparisonPanel({
  futureSelf,
  onBuildProtocol,
  onSaveScenario,
  buildingProtocol,
  savingScenario,
  saveMessage,
}: {
  futureSelf: FutureSelfProjection;
  onBuildProtocol: () => void;
  onSaveScenario: () => void;
  buildingProtocol: boolean;
  savingScenario: boolean;
  saveMessage: string | null;
}) {
  const chart = buildFutureSelfChart(futureSelf.trajectory);
  const finalPoint = futureSelf.trajectory[futureSelf.trajectory.length - 1];

  return (
    <div className="mt-6 executive-panel rounded-lg p-6 md:p-7">
      <div className="mb-6 flex flex-col gap-3 border-b border-white/[0.06] pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="micro-label">Future self simulator</p>
          <h2 className="mt-3 text-3xl font-light text-white">
            Current trajectory versus optimized trajectory.
          </h2>
        </div>
        <p className="max-w-sm text-sm leading-6 text-white/38">
          {futureSelf.summary}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-5">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm text-white/52">Projected separation</p>
              <p className="mt-2 text-3xl font-light leading-none royal-text">
                {finalPoint?.gap?.toFixed(1) || "0.0"} yrs
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-sm text-white/52">{futureSelf.headline}</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-white/24">
                {futureSelf.horizonDays} day horizon
              </p>
            </div>
          </div>

          <svg viewBox="0 0 100 60" className="h-56 w-full overflow-visible" aria-hidden="true">
            <polyline
              points={chart.current.join(" ")}
              fill="none"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="1.8"
              strokeDasharray="4 5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points={chart.optimized.join(" ")}
              fill="none"
              stroke="rgba(218,188,115,0.9)"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {chart.optimized.map((point, index) => {
              const [cx, cy] = point.split(",");
              return (
                <circle
                  key={`${point}-${index}`}
                  cx={cx}
                  cy={cy}
                  r={index === chart.optimized.length - 1 ? "2.8" : "1.8"}
                  fill="rgba(248,250,252,0.92)"
                />
              );
            })}
          </svg>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              ["Now", futureSelf.baseline.biologicalAge],
              ["Current", finalPoint?.currentBiologicalAge ?? futureSelf.baseline.biologicalAge],
              ["Optimized", finalPoint?.optimizedBiologicalAge ?? futureSelf.optimized.biologicalAge],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
                <p className="text-[9px] uppercase tracking-[0.14em] text-white/22">
                  {label}
                </p>
                <p className="mt-2 text-sm text-white/64">{value} yrs</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-5">
            <p className="micro-label mb-4">Dominant levers</p>
            <div className="space-y-3">
              {futureSelf.levers.slice(0, 4).map((lever) => (
                <div key={lever.key} className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm text-white/68">{lever.label}</p>
                    <span className={futureSelfImpactClassName(lever.impact)}>
                      {lever.impact}
                    </span>
                  </div>
                  <p className="text-xs leading-5 text-white/36">
                    {lever.current} → {lever.optimized}
                  </p>
                </div>
              ))}
              {!futureSelf.levers.length && (
                <p className="text-sm leading-7 text-white/38">
                  Move a simulator lever to create a stronger optimized path.
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onBuildProtocol}
            disabled={buildingProtocol}
            className="premium-action inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
          >
            {buildingProtocol ? "Building protocol" : "Build protocol from future self"}
          </button>
          <button
            type="button"
            onClick={onSaveScenario}
            disabled={savingScenario}
            className="premium-action-secondary inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
          >
            {savingScenario ? "Saving scenario" : "Save shareable scenario"}
          </button>
          {saveMessage && (
            <p className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-4 text-sm leading-6 text-white/48">
              {saveMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ScenarioStackPanel({
  scenarios,
  selectedScenarioIds,
  runningProjection,
  onToggleScenario,
  onRunProjection,
}: {
  scenarios: ScenarioPreset[];
  selectedScenarioIds: string[];
  runningProjection: boolean;
  onToggleScenario: (scenarioId: string) => void;
  onRunProjection: () => void;
}) {
  return (
    <div className="mt-6 executive-panel rounded-lg p-6 md:p-7">
      <div className="mb-6 flex flex-col gap-3 border-b border-white/[0.06] pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="micro-label">Scenario stack</p>
          <h2 className="mt-3 text-3xl font-light text-white">
            Combine changes and compare the future.
          </h2>
        </div>
        <button
          type="button"
          onClick={onRunProjection}
          disabled={runningProjection}
          className="premium-action inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
        >
          {runningProjection ? "Projecting" : selectedScenarioIds.length ? "Run stacked projection" : "Run projection"}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        {scenarios.map((scenario) => {
          const selected = selectedScenarioIds.includes(scenario.id);

          return (
            <button
              key={scenario.id}
              type="button"
              onClick={() => onToggleScenario(scenario.id)}
              className={`quiet-lift min-h-52 rounded-lg border p-4 text-left transition ${
                selected
                  ? "border-white/[0.18] bg-white/[0.065]"
                  : "border-white/[0.07] bg-white/[0.025]"
              }`}
            >
              <div className="flex h-full flex-col">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <span className="text-[9px] uppercase tracking-[0.14em] text-white/24">
                    {scenario.domain}
                  </span>
                  <span className={selected ? "royal-text text-sm" : "text-sm text-white/22"}>
                    {selected ? "on" : "off"}
                  </span>
                </div>
                <p className="text-base font-light leading-6 text-white/78">
                  {scenario.title}
                </p>
                <p className="mt-3 line-clamp-4 text-xs leading-5 text-white/38">
                  {scenario.description}
                </p>
                <p className="mt-auto pt-4 text-[9px] uppercase tracking-[0.14em] text-white/24">
                  {scenario.horizon}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SavedFutureSelfScenariosPanel({
  scenarios,
  message,
  comparisonScenarioIds,
  onToggleComparison,
}: {
  scenarios: SavedFutureSelfScenario[];
  message: string | null;
  comparisonScenarioIds: string[];
  onToggleComparison: (scenarioId: string) => void;
}) {
  const comparisonScenarios = comparisonScenarioIds
    .map((id) => scenarios.find((scenario) => scenario.id === id))
    .filter((scenario): scenario is SavedFutureSelfScenario => Boolean(scenario));

  return (
    <div className="mt-6 executive-panel rounded-lg p-6 md:p-7">
      <div className="mb-6 flex flex-col gap-3 border-b border-white/[0.06] pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="micro-label">Saved Future Selves</p>
          <h2 className="mt-3 text-3xl font-light text-white">
            Reopen or share your strongest scenarios.
          </h2>
        </div>
        {message && (
          <p className="max-w-sm text-sm leading-6 text-white/42">
            {message}
          </p>
        )}
      </div>

      {scenarios.length ? (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            {scenarios.slice(0, 6).map((scenario) => {
              const selected = comparisonScenarioIds.includes(scenario.id);

              return (
                <div
                  key={scenario.id}
                  className={`quiet-lift rounded-lg border bg-white/[0.025] p-5 transition ${
                    selected ? "border-white/[0.18]" : "border-white/[0.07] hover:border-white/[0.16]"
                  }`}
                >
                  <Link
                    href={`/future-self/${scenario.share_token}`}
                    className="flex min-h-36 flex-col"
                  >
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <span className="text-[9px] uppercase tracking-[0.14em] text-white/24">
                        v{scenario.version_number || 1}
                      </span>
                      <span className="royal-text text-sm">
                        {scenario.scenario_ids.length || 1}
                      </span>
                    </div>
                    <p className="text-lg font-light leading-7 text-white/80">
                      {scenario.title}
                    </p>
                    <p className="mt-3 line-clamp-3 text-xs leading-5 text-white/38">
                      {scenario.description || "Saved future-self projection."}
                    </p>
                    <p className="mt-auto pt-4 text-[9px] uppercase tracking-[0.14em] text-white/24">
                      {formatScenarioDate(scenario.created_at)}
                    </p>
                  </Link>
                  <button
                    type="button"
                    onClick={() => onToggleComparison(scenario.id)}
                    className="premium-action-secondary mt-4 inline-flex h-9 w-full items-center justify-center rounded-md px-4 text-[10px] uppercase tracking-[0.14em]"
                  >
                    {selected ? "Selected" : "Compare"}
                  </button>
                </div>
              );
            })}
          </div>

          {comparisonScenarios.length > 0 && (
            <ScenarioComparisonPanel scenarios={comparisonScenarios} />
          )}
        </>
      ) : (
        <p className="text-sm leading-7 text-white/42">
          Save a future-self projection to create a public read-only scenario page.
        </p>
      )}
    </div>
  );
}

function ScenarioComparisonPanel({
  scenarios,
}: {
  scenarios: SavedFutureSelfScenario[];
}) {
  return (
    <div className="mt-5 rounded-lg border border-white/[0.07] bg-white/[0.025] p-5">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="micro-label">Scenario comparison</p>
          <p className="mt-3 text-xl font-light text-white/82">
            Compare saved future-self versions.
          </p>
        </div>
        <p className="text-sm text-white/34">
          Select two saved scenarios for the clearest contrast.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {scenarios.map((scenario) => (
          <div key={scenario.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm text-white/72">{scenario.title}</p>
              <span className="royal-text text-sm">v{scenario.version_number || 1}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                ["Bio age", scenario.future_self?.optimized?.biologicalAge ?? scenario.projection?.biologicalAge],
                ["Score", scenario.future_self?.optimized?.score ?? scenario.projection?.score],
                ["Gain", scenario.future_self?.optimized?.projectedBiologicalAgeImprovement ?? scenario.projection?.projectedBiologicalAgeImprovement],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
                  <p className="text-[9px] uppercase tracking-[0.14em] text-white/22">
                    {label}
                  </p>
                  <p className="mt-2 text-sm text-white/64">
                    {typeof value === "number" ? value.toFixed(label === "Score" ? 0 : 1) : "--"}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-white/36">
              {scenario.future_self?.headline || scenario.description || "Saved projection"}
            </p>
          </div>
        ))}
      </div>
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

function buildFutureSelfChart(points: FutureSelfProjection["trajectory"]) {
  const values = points.flatMap((point) => [
    point.currentBiologicalAge,
    point.optimizedBiologicalAge,
  ]);
  const min = Math.min(...values) - 0.5;
  const max = Math.max(...values) + 0.5;
  const span = Math.max(1, max - min);
  const toPoint = (
    value: number,
    index: number,
  ) => {
    const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
    const y = 54 - ((value - min) / span) * 48;
    return `${x},${y}`;
  };

  return {
    current: points.map((point, index) => toPoint(point.currentBiologicalAge, index)),
    optimized: points.map((point, index) => toPoint(point.optimizedBiologicalAge, index)),
  };
}

function futureSelfImpactClassName(impact: "low" | "medium" | "high") {
  const base = "rounded-md px-2 py-1 text-[8px] uppercase tracking-[0.14em]";

  if (impact === "high") return `${base} royal-text bg-white/[0.035]`;
  if (impact === "medium") return `${base} text-white/42 bg-white/[0.025]`;
  return `${base} text-white/28 bg-white/[0.02]`;
}

function formatScenarioDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Saved scenario";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
