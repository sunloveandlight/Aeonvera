"use client";

import { type CSSProperties, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import PageContainer from "@/components/ui/PageContainer";

type Question = {
  id: string;
  domain: string;
  prompt: string;
  options: string[];
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

const DOMAINS = [
  "Sleep architecture",
  "Resting heart rate",
  "HRV",
  "VO2 max",
  "Strength",
  "Mobility",
  "Glucose",
  "Lipids",
  "Body composition",
  "Cognition",
  "Stress load",
  "Nutrition",
];

export default function OptimizationPage() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [context, setContext] = useState("");
  const [showMap, setShowMap] = useState(false);

  const question = QUESTIONS[step];
  const answeredCount = Object.keys(answers).length;
  const progress = Math.round((answeredCount / QUESTIONS.length) * 100);
  const complete = showMap && answeredCount === QUESTIONS.length;

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

  function nextQuestion() {
    if (step === QUESTIONS.length - 1 && answers[question.id]) {
      setShowMap(true);
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

  return (
    <PageContainer>
      <div className="py-16">
        <div className="mb-10 flex flex-col gap-5 border-b border-white/[0.06] pb-8 lg:flex-row lg:items-end lg:justify-between">
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
            className="premium-action-secondary inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-medium"
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
                    disabled={!answers[question.id]}
                    className="premium-action inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {step === QUESTIONS.length - 1 ? "Build map" : "Next question"}
                    <ArrowRight size={16} />
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-5">
                <div className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-5">
                  <div className="flex items-center gap-3">
                    <div className="premium-status flex size-10 items-center justify-center rounded-lg">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white/80">First optimization map is ready</p>
                      <p className="mt-1 text-xs leading-5 text-white/40">
                        Next we connect this intake to the coach engine, health state, and wearable history.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {DOMAINS.map((domain, index) => (
                    <div key={domain} className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm text-white/68">{domain}</p>
                        <span className="text-[10px] uppercase tracking-[0.14em] text-white/28">
                          {index < 4 ? "Priority" : "Track"}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="living-bar h-full rounded-full"
                          style={{ width: `${82 - index * 3}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setStep(0);
                    setAnswers({});
                    setContext("");
                    setShowMap(false);
                  }}
                  className="premium-action-secondary inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-medium"
                >
                  Restart intake
                </button>
              </div>
            )}
          </div>
        </div>
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
