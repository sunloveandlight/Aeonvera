"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import PageContainer from "@/components/ui/PageContainer";

type SharedScenario = {
  title: string;
  description: string | null;
  scenario_ids: string[];
  share_token: string;
  created_at: string;
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

  const trajectory = useMemo(
    () => scenario?.future_self.trajectory || [],
    [scenario]
  );
  const chart = useMemo(() => buildChart(trajectory), [trajectory]);
  const finalPoint = trajectory[trajectory.length - 1];

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
                  <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-white/24">
                    {scenario.future_self.horizonDays || 180} day horizon
                  </p>
                </div>
              </div>

              <svg viewBox="0 0 100 60" className="h-64 w-full overflow-visible" aria-hidden="true">
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
                  ["Now", scenario.future_self.baseline?.biologicalAge],
                  ["Current", finalPoint?.currentBiologicalAge],
                  ["Optimized", finalPoint?.optimizedBiologicalAge],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
                    <p className="text-[9px] uppercase tracking-[0.14em] text-white/22">
                      {label}
                    </p>
                    <p className="mt-2 text-sm text-white/64">{value || "--"} yrs</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="executive-panel rounded-lg p-6 md:p-7">
                <p className="micro-label mb-5">Scenario Stack</p>
                <div className="space-y-3">
                  {(scenario.future_self.activeScenarios || []).map((activeScenario) => (
                    <div key={activeScenario.id} className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-sm text-white/70">{activeScenario.title}</p>
                        <span className="text-[9px] uppercase tracking-[0.14em] text-white/24">
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
          </div>
        ) : null}
      </div>
    </PageContainer>
  );
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
  const base = "rounded-md px-2 py-1 text-[8px] uppercase tracking-[0.14em]";

  if (impact === "high") return `${base} royal-text bg-white/[0.035]`;
  if (impact === "medium") return `${base} text-white/42 bg-white/[0.025]`;
  return `${base} text-white/28 bg-white/[0.02]`;
}
