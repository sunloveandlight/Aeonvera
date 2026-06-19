"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import PageContainer from "@/components/ui/PageContainer";

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

type SharedScenario = {
  title: string;
  description: string | null;
  scenario_ids: string[];
  share_token: string;
  created_at: string;
  controls: Record<string, number>;
  projection: {
    biologicalAge?: number;
    ageDelta?: number;
    score?: number;
    projectedAgeDeltaImprovement?: number;
    projectedBiologicalAgeImprovement?: number;
  };
  future_self: {
    baseline?: {
      biologicalAge?: number;
      score?: number;
    };
    optimized?: {
      biologicalAge?: number;
      score?: number;
      projectedBiologicalAgeImprovement?: number;
    };
    trajectory?: Array<{
      day: number;
      currentBiologicalAge: number;
      optimizedBiologicalAge: number;
      gap: number;
    }>;
    levers?: Array<{
      key: string;
      label: string;
      current: number;
      optimized: number;
      impact: "low" | "medium" | "high";
    }>;
    headline?: string;
    summary?: string;
    horizonDays?: number;
    activeScenarios?: Array<{
      id: string;
      title: string;
      domain: string;
      horizon: string;
    }>;
  };
};

export default function SharedFutureSelfPage() {
  const params = useParams<{ shareToken: string }>();
  const [scenario, setScenario] = useState<SharedScenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [generatingProtocol, setGeneratingProtocol] = useState(false);
  const [protocol, setProtocol] = useState<OptimizationProtocol | null>(null);
  const [protocolHistory, setProtocolHistory] = useState<OptimizationProtocol[]>([]);
  const [protocolMessage, setProtocolMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadScenario() {
      setLoading(true);
      setMessage(null);

      try {
        const response = await fetch(
          `/api/longevity/future-self/scenarios/${params.shareToken}`
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Could not load this future-self scenario.");
        }

        if (!cancelled) {
          setScenario(data.scenario);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Could not load this future-self scenario."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (params.shareToken) {
      void loadScenario();
    }

    return () => {
      cancelled = true;
    };
  }, [params.shareToken]);

  useEffect(() => {
    let cancelled = false;

    async function loadProtocolHistory() {
      try {
        const response = await fetch("/api/optimization/protocols", {
          credentials: "include",
        });
        const data = await response.json();

        if (!cancelled && Array.isArray(data?.protocols)) {
          setProtocolHistory(
            data.protocols
              .map((row: { protocol?: OptimizationProtocol }) => row.protocol)
              .filter(Boolean)
              .slice(0, 4)
          );
        }
      } catch {
        if (!cancelled) setProtocolHistory([]);
      }
    }

    void loadProtocolHistory();

    return () => {
      cancelled = true;
    };
  }, []);

  const trajectory = useMemo(
    () => scenario?.future_self.trajectory || [],
    [scenario]
  );
  const chart = useMemo(() => buildChart(trajectory), [trajectory]);
  const finalPoint = trajectory[trajectory.length - 1];

  async function generateProtocolFromScenario() {
    if (!scenario) return;

    setGeneratingProtocol(true);
    setProtocolMessage(null);

    try {
      const response = await fetch("/api/optimization/protocol", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          answers: buildScenarioAnswers(scenario),
          questions: buildScenarioQuestions(),
          context: buildScenarioContext(scenario),
          projectionContext: {
            controls: scenario.controls,
            projection: scenario.projection,
          },
          sourceScenarioShareToken: scenario.share_token,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Sign in to generate a private protocol from this scenario.");
        }

        throw new Error(data.error || "Could not generate protocol.");
      }

      setProtocol(data.protocol.protocol as OptimizationProtocol);
      setProtocolHistory((current) => [
        data.protocol.protocol as OptimizationProtocol,
        ...current,
      ].slice(0, 4));
      setProtocolMessage("Protocol generated and saved to your account.");
    } catch (error) {
      setProtocolMessage(
        error instanceof Error ? error.message : "Could not generate protocol."
      );
    } finally {
      setGeneratingProtocol(false);
    }
  }

  return (
    <PageContainer>
      <div className="py-16">
        <div className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="micro-label mb-5">Shared Future Self</p>
            <h1 className="max-w-4xl text-5xl font-light leading-[1.04] text-white md:text-6xl">
              {scenario?.title || "Future-self scenario"}
            </h1>
            <p className="mt-6 max-w-2xl text-sm leading-7 text-white/50">
              {scenario?.future_self.summary ||
                scenario?.description ||
                "A public read-only Aeonvera projection."}
            </p>
          </div>
          <Link
            href="/login?mode=signup"
            className="premium-action inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium"
          >
            Build mine <ArrowRight size={16} />
          </Link>
        </div>

        {loading ? (
          <div className="executive-panel rounded-lg p-8">
            <p className="micro-label">Loading scenario</p>
          </div>
        ) : message ? (
          <div className="executive-panel rounded-lg p-8">
            <p className="micro-label">Unavailable</p>
            <p className="mt-4 text-sm leading-7 text-white/50">{message}</p>
          </div>
        ) : scenario ? (
          <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="executive-panel rounded-lg p-6 md:p-7">
              <div className="mb-6 flex flex-col gap-4 border-b border-white/[0.06] pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm text-white/52">Projected separation</p>
                  <p className="mt-2 text-4xl font-light leading-none royal-text">
                    {finalPoint?.gap?.toFixed(1) || "0.0"} yrs
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-sm text-white/52">
                    {scenario.future_self.headline || "Optimized future-self path"}
                  </p>
                  <p className="av-eyebrow mt-1 text-white/24">
                    {scenario.future_self.horizonDays || 180} day horizon
                  </p>
                </div>
              </div>

              <svg viewBox="0 0 100 60" className="h-64 w-full overflow-visible text-white/80" aria-hidden="true">
                <polyline
                  points={chart.current.join(" ")}
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity={0.18}
                  strokeWidth="1.8"
                  strokeDasharray="4 5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline
                  points={chart.optimized.join(" ")}
                  fill="none"
                  stroke="rgba(var(--gold),0.9)"
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
                      fill="currentColor"
                      fillOpacity={0.92}
                    />
                  );
                })}
              </svg>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  ["Now", scenario.future_self.baseline?.biologicalAge],
                  ["Current", finalPoint?.currentBiologicalAge],
                  ["Optimized", finalPoint?.optimizedBiologicalAge],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
                    <p className="av-eyebrow text-white/22">
                      {label}
                    </p>
                    <p className="mt-2 text-sm text-white/64">{value || "--"} yrs</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="executive-panel rounded-lg p-6 md:p-7">
                <p className="micro-label mb-5">Scenario Protocol</p>
                <p className="text-sm leading-7 text-white/46">
                  Generate a private protocol from this future-self projection and save it to your Aeonvera account.
                </p>
                <button
                  type="button"
                  onClick={() => void generateProtocolFromScenario()}
                  disabled={generatingProtocol}
                  className="premium-action mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md px-5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {generatingProtocol ? "Generating protocol" : "Generate protocol"}
                  <ArrowRight size={16} />
                </button>
                {protocolMessage && (
                  <p className="mt-4 rounded-lg border border-white/[0.07] bg-white/[0.025] p-4 text-sm leading-6 text-white/48">
                    {protocolMessage}
                  </p>
                )}
                {protocolMessage?.startsWith("Sign in") && (
                  <Link
                    href="/login?mode=signin"
                    className="premium-action-secondary mt-3 inline-flex h-10 w-full items-center justify-center rounded-md px-4 text-sm font-medium"
                  >
                    Sign in
                  </Link>
                )}
              </div>

              <div className="executive-panel rounded-lg p-6 md:p-7">
                <p className="micro-label mb-5">Scenario Stack</p>
                <div className="space-y-3">
                  {(scenario.future_self.activeScenarios || []).map((activeScenario) => (
                    <div key={activeScenario.id} className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-sm text-white/70">{activeScenario.title}</p>
                        <span className="av-eyebrow text-white/24">
                          {activeScenario.domain}
                        </span>
                      </div>
                      <p className="text-xs text-white/34">{activeScenario.horizon}</p>
                    </div>
                  ))}
                  {!scenario.future_self.activeScenarios?.length && (
                    <p className="text-sm leading-7 text-white/42">
                      Custom projection saved from the Future Self simulator.
                    </p>
                  )}
                </div>
              </div>

              <div className="executive-panel rounded-lg p-6 md:p-7">
                <p className="micro-label mb-5">Dominant Levers</p>
                <div className="space-y-3">
                  {(scenario.future_self.levers || []).slice(0, 5).map((lever) => (
                    <div key={lever.key} className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-sm text-white/68">{lever.label}</p>
                        <span className={impactClassName(lever.impact)}>
                          {lever.impact}
                        </span>
                      </div>
                      <p className="text-xs leading-5 text-white/36">
                        {lever.current} → {lever.optimized}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {protocol && (
              <div className="lg:col-span-2">
                <GeneratedProtocolReport protocol={protocol} />
              </div>
            )}

            {!protocol && protocolHistory.length > 0 && (
              <div className="lg:col-span-2">
                <ProtocolHistoryPanel protocols={protocolHistory} />
              </div>
            )}
          </div>
        ) : null}
      </div>
    </PageContainer>
  );
}

function ProtocolHistoryPanel({ protocols }: { protocols: OptimizationProtocol[] }) {
  return (
    <div className="mt-6 executive-panel rounded-lg p-6 md:p-7">
      <div className="mb-6 flex flex-col gap-3 border-b border-white/[0.06] pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="micro-label">Protocol History</p>
          <h2 className="mt-3 text-3xl font-light text-white">
            Recent optimization plans.
          </h2>
        </div>
        <p className="max-w-sm text-sm leading-6 text-white/42">
          Your latest generated protocols stay available as your scenario versions evolve.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {protocols.map((item, index) => (
          <div key={`${item.summary}-${index}`} className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="av-eyebrow text-white/24">
                Protocol {String(index + 1).padStart(2, "0")}
              </span>
              <span className="royal-text text-sm">
                {item.focus_domains?.[0] || "Focus"}
              </span>
            </div>
            <p className="text-sm leading-7 text-white/62">{item.summary}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function GeneratedProtocolReport({ protocol }: { protocol: OptimizationProtocol }) {
  return (
    <div className="mt-6 executive-panel rounded-lg p-6 md:p-7">
      <div className="mb-6 flex flex-col gap-3 border-b border-white/[0.06] pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="micro-label">Generated Protocol</p>
          <h2 className="mt-3 text-3xl font-light text-white">
            Your future-self operating plan.
          </h2>
        </div>
        <p className="max-w-sm text-sm leading-6 text-white/42">
          {protocol.coach_message || protocol.summary}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="mb-5 text-sm leading-7 text-white/52">{protocol.summary}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {protocol.primary_protocol.slice(0, 6).map((action) => (
              <div key={`${action.domain}-${action.action}`} className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm text-white/70">{action.domain}</p>
                  <span className={impactClassName(action.impact)}>
                    {action.impact}
                  </span>
                </div>
                <p className="text-xs leading-5 text-white/42">{action.action}</p>
                <p className="av-eyebrow mt-3 text-white/24">
                  {action.cadence}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-4">
            <p className="micro-label mb-4">Weekly Sequence</p>
            <div className="space-y-3">
              {protocol.weekly_sequence.slice(0, 4).map((week) => (
                <div key={week.week} className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-4">
                  <p className="av-eyebrow text-white/24">
                    {week.week}
                  </p>
                  <p className="mt-2 text-sm font-medium text-white/70">{week.focus}</p>
                  <p className="mt-2 text-xs leading-5 text-white/36">
                    {week.actions.slice(0, 2).join(" / ")}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-4">
            <p className="micro-label mb-4">Tracking Metrics</p>
            <div className="space-y-3">
              {protocol.tracking_metrics.slice(0, 5).map((metric) => (
                <div key={metric.metric}>
                  <p className="text-sm text-white/68">{metric.metric}</p>
                  <p className="mt-1 text-xs leading-5 text-white/36">
                    {metric.target} / {metric.source}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildScenarioQuestions() {
  return [
    {
      id: "priority",
      domain: "Future Self",
      prompt: "What should Aeonvera optimize from this shared scenario?",
      options: ["Biological-age reduction", "Recovery", "Metabolic health", "Performance"],
    },
  ];
}

function buildScenarioAnswers(scenario: SharedScenario) {
  const primaryLever = scenario.future_self.levers?.[0]?.label || "Biological-age reduction";

  return {
    priority: primaryLever,
  };
}

function buildScenarioContext(scenario: SharedScenario) {
  const levers = (scenario.future_self.levers || [])
    .slice(0, 5)
    .map((lever) => `${lever.label}: ${lever.current} to ${lever.optimized}`)
    .join("; ");
  const stack = (scenario.future_self.activeScenarios || [])
    .map((activeScenario) => activeScenario.title)
    .join(", ");
  const improvement = scenario.projection.projectedBiologicalAgeImprovement;

  return [
    `Generate a protocol from saved Future Self scenario: ${scenario.title}.`,
    scenario.future_self.summary ? `Scenario summary: ${scenario.future_self.summary}` : null,
    scenario.future_self.headline ? `Scenario headline: ${scenario.future_self.headline}` : null,
    Number.isFinite(improvement)
      ? `Projected biological-age improvement: ${improvement} years.`
      : null,
    levers ? `Target levers: ${levers}.` : null,
    stack ? `Scenario stack: ${stack}.` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildChart(points: SharedScenario["future_self"]["trajectory"]) {
  if (!points?.length) return { current: [], optimized: [] };

  const values = points.flatMap((point) => [
    point.currentBiologicalAge,
    point.optimizedBiologicalAge,
  ]);
  const min = Math.min(...values) - 0.5;
  const max = Math.max(...values) + 0.5;
  const span = Math.max(1, max - min);
  const toPoint = (value: number, index: number) => {
    const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
    const y = 54 - ((value - min) / span) * 48;
    return `${x},${y}`;
  };

  return {
    current: points.map((point, index) => toPoint(point.currentBiologicalAge, index)),
    optimized: points.map((point, index) => toPoint(point.optimizedBiologicalAge, index)),
  };
}

function impactClassName(impact: "low" | "medium" | "high") {
  const base = "av-eyebrow rounded-md px-2 py-1";

  if (impact === "high") return `${base} royal-text bg-white/[0.035]`;
  if (impact === "medium") return `${base} text-white/42 bg-white/[0.025]`;
  return `${base} text-white/28 bg-white/[0.02]`;
}
