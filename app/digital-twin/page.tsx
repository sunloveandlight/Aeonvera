"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, ArrowRight, Brain, Clock3, Dna, FileText, FlaskConical, HeartPulse, Printer, Sparkles, type LucideIcon } from "lucide-react";
import PageContainer from "@/components/ui/PageContainer";
import AccessState, { EmptyState } from "@/components/ui/AccessState";
import { supabase } from "@/lib/supabase/client";

type TimelineEvent = {
  id: string;
  type: "assessment" | "biological_age" | "lab" | "protocol" | "report" | "coach" | "scenario" | "wearable" | "outcome";
  title: string;
  detail: string;
  occurred_at: string;
  signal?: string;
  href?: string;
};

type DigitalTwinPayload = {
  locked?: boolean;
  upgrade?: {
    minimumPlan?: string;
    message?: string;
  };
  profile: {
    display_name?: string | null;
    plan?: string | null;
    biological_age?: number | null;
  } | null;
  state: {
    insights?: string[];
    risk_scores?: Record<string, number>;
    updated_at?: string;
  } | null;
  intelligence?: TwinIntelligence;
  model?: TwinModel;
  timeline: TimelineEvent[];
  counts: Record<string, number>;
};

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

type TwinModel = {
  domains: TwinDomain[];
  readiness: {
    detail: string;
    score: number;
    status: string;
  };
  scenarioPrompts: TwinScenarioPrompt[];
};

type TwinProjectionResult = {
  activeScenarioIds?: string[];
  baseline?: {
    biologicalAge: number;
    score: number;
  };
  controls?: Record<string, number>;
  futureSelf?: {
    headline?: string;
    summary?: string;
    levers?: Array<{
      impact: "low" | "medium" | "high";
      label: string;
      optimized: number;
    }>;
  };
  projection?: {
    biologicalAge: number;
    projectedAgeDeltaImprovement: number;
    projectedBiologicalAgeImprovement: number;
    score: number;
  };
};

const TYPE_FILTERS: Array<TimelineEvent["type"] | "all"> = [
  "all",
  "biological_age",
  "protocol",
  "lab",
  "scenario",
  "wearable",
  "outcome",
  "coach",
  "report",
  "assessment",
];

const MODEL_INPUTS: Array<[string, keyof DigitalTwinPayload["counts"], LucideIcon]> = [
  ["Assessments", "assessments", Brain],
  ["Biological age points", "biologicalAgePoints", HeartPulse],
  ["Clinical biomarkers", "labs", FlaskConical],
  ["Future scenarios", "scenarios", Dna],
  ["Outcomes", "outcomes", Sparkles],
  ["Reports", "reports", FileText],
];

export default function DigitalTwinPage() {
  const [payload, setPayload] = useState<DigitalTwinPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [outcomeMessage, setOutcomeMessage] = useState<string | null>(null);
  const [savingOutcome, setSavingOutcome] = useState(false);
  const [outcomeForm, setOutcomeForm] = useState({
    domain: "Recovery",
    action: "",
    outcome: "success",
    notes: "",
  });
  const [activeType, setActiveType] = useState<TimelineEvent["type"] | "all">("all");
  const [projectionResult, setProjectionResult] = useState<TwinProjectionResult | null>(null);
  const [projectionMessage, setProjectionMessage] = useState<string | null>(null);
  const [projectionSavedMessage, setProjectionSavedMessage] = useState<string | null>(null);
  const [runningProjection, setRunningProjection] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTwin() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) {
          setSignedOut(true);
          setLoading(false);
        }
        return;
      }

      try {
        const response = await fetch("/api/digital-twin/timeline", {
          credentials: "include",
        });
        const data = await response.json();

        if (!response.ok && response.status !== 403) {
          throw new Error(data.error || "Could not load digital twin.");
        }

        if (!cancelled) {
          setPayload(data);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Could not load digital twin.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadTwin();

    return () => {
      cancelled = true;
    };
  }, []);

  const timeline = useMemo(() => {
    const events = payload?.timeline || [];
    return activeType === "all"
      ? events
      : events.filter((event) => event.type === activeType);
  }, [activeType, payload]);

  const latestBioAge = payload?.profile?.biological_age;
  const insight = payload?.state?.insights?.[0] || "Your living health model is assembling from assessments, labs, protocols, coach signals, and wearable data.";

  async function saveOutcome() {
    if (!outcomeForm.action.trim()) {
      setOutcomeMessage("Add the action you tested before saving an outcome.");
      return;
    }

    setSavingOutcome(true);
    setOutcomeMessage(null);

    try {
      const response = await fetch("/api/digital-twin/outcomes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          domain: outcomeForm.domain,
          action: outcomeForm.action,
          outcome: outcomeForm.outcome,
          confidence: outcomeForm.outcome === "unknown" ? 0.5 : 0.8,
          notes: outcomeForm.notes,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not save outcome.");
      }

      setOutcomeMessage("Outcome saved. Your Digital Twin timeline will learn from this.");
      setOutcomeForm((current) => ({ ...current, action: "", notes: "" }));

      const timelineResponse = await fetch("/api/digital-twin/timeline", {
        credentials: "include",
      });
      const timelineData = await timelineResponse.json();
      if (timelineResponse.ok) setPayload(timelineData);
    } catch (error) {
      setOutcomeMessage(error instanceof Error ? error.message : "Could not save outcome.");
    } finally {
      setSavingOutcome(false);
    }
  }

  async function runTwinProjection(prompt: TwinScenarioPrompt) {
    setRunningProjection(prompt.question);
    setProjectionMessage(null);
    setProjectionSavedMessage(null);
    setProjectionResult(null);

    try {
      const response = await fetch("/api/longevity/simulator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          scenarioIds: prompt.scenarioIds,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not run this projection.");
      }

      setProjectionResult(data as TwinProjectionResult);
      setProjectionMessage(`Projection complete: ${prompt.question}`);

      const saveResponse = await fetch("/api/longevity/future-self/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: prompt.question.replace(/\?$/, ""),
          description:
            data.futureSelf?.summary ||
            data.futureSelf?.headline ||
            "Digital Twin projection saved from scenario intelligence.",
          scenarioIds: data.activeScenarioIds || prompt.scenarioIds,
          controls: data.controls || {},
          projection: data.projection || {},
          futureSelf: data.futureSelf || {},
          isPublic: false,
        }),
      });
      const saved = await saveResponse.json().catch(() => null);

      if (!saveResponse.ok) {
        throw new Error(saved?.error || "Projection ran, but could not be saved to the timeline.");
      }

      setProjectionSavedMessage("Saved to your Digital Twin timeline.");

      const timelineResponse = await fetch("/api/digital-twin/timeline", {
        credentials: "include",
      });
      const timelineData = await timelineResponse.json();
      if (timelineResponse.ok) setPayload(timelineData);
    } catch (error) {
      setProjectionMessage(
        error instanceof Error ? error.message : "Could not run this projection."
      );
    } finally {
      setRunningProjection(null);
    }
  }

  return (
    <PageContainer>
      <div className="py-16">
        <div className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="micro-label mb-5">Digital Twin</p>
            <h1 className="max-w-4xl text-5xl font-light leading-[1.04] text-white md:text-6xl">
              A living model of your healthspan.
            </h1>
            <p className="mt-6 max-w-2xl text-sm leading-7 text-white/50">
              {insight}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/optimization"
              className="premium-action inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium"
            >
              Optimize <ArrowRight size={16} />
            </Link>
            <Link
              href="/physician-export"
              className="premium-action-secondary inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium"
            >
              Export <Printer size={16} />
            </Link>
          </div>
        </div>

        {loading ? (
          <AccessState
            eyebrow="Digital Twin"
            title="Assembling your private health model."
            body="Aeonvera is reading your timeline, outcomes, biomarkers, protocols, and wearable signals."
            actions={[{ href: "/plan", label: "View access", variant: "secondary" }]}
          />
        ) : signedOut ? (
          <AccessState
            eyebrow="Digital Twin"
            title="Sign in to open your living health model."
            body="Your Digital Twin is built from private health signals, so Aeonvera only opens it inside your secure account."
            points={[
              "Longitudinal health timeline",
              "Outcome-aware model updates",
              "Physician-ready export layer",
            ]}
            actions={[
              { href: "/login?mode=signin", label: "Sign in" },
              { href: "/pricing", label: "Compare tiers", variant: "secondary" },
            ]}
          />
        ) : message ? (
          <div className="executive-panel rounded-lg p-8">
            <p className="micro-label">Unavailable</p>
            <p className="mt-4 text-sm leading-7 text-white/50">{message}</p>
          </div>
        ) : payload?.locked ? (
          <AccessState
            eyebrow="Sovereign Intelligence"
            title="Unlock the executive model layer."
            body={
              payload.upgrade?.message ||
              "Sovereign unlocks the full living timeline across biomarkers, protocols, scenarios, wearables, outcomes, and clinical memory."
            }
            points={[
              "Unified health timeline",
              "Digital Twin intelligence panel",
              "Physician-ready export",
            ]}
            actions={[
              { href: "/pricing", label: "Unlock Sovereign" },
              { href: "/plan", label: "Your Plan", variant: "secondary" },
            ]}
          />
        ) : payload ? (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              {buildSummaryCards(payload, latestBioAge).map(([label, value, suffix, Icon]) => (
                <div key={String(label)} className="executive-panel rounded-lg p-5">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <p className="micro-label">{String(label)}</p>
                    <Icon size={17} className="royal-text" />
                  </div>
                  <div className="flex items-end gap-2">
                    <p className="text-4xl font-light leading-none text-white/88">
                      {String(value)}
                    </p>
                    <p className="mb-1 text-xs uppercase tracking-[0.14em] text-white/24">
                      {String(suffix)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {payload.intelligence && (
              <DigitalTwinIntelligencePanel intelligence={payload.intelligence} />
            )}

            {payload.model && (
              <LivingTwinModelPanel
                model={payload.model}
                projectionMessage={projectionMessage}
                projectionResult={projectionResult}
                projectionSavedMessage={projectionSavedMessage}
                runningProjection={runningProjection}
                onRunProjection={runTwinProjection}
              />
            )}

            <div className="mt-6 grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
              <div className="space-y-6">
                <div className="executive-panel rounded-lg p-6 md:p-7">
                  <p className="micro-label mb-5">Model Inputs</p>
                  <div className="space-y-3">
                    {MODEL_INPUTS.map(([label, key, Icon]) => (
                      <div key={String(label)} className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <Icon size={16} className="royal-text" />
                            <p className="text-sm text-white/68">{String(label)}</p>
                          </div>
                          <p className="text-sm text-white/44">{String(payload.counts[key] || 0)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="executive-panel rounded-lg p-6 md:p-7">
                  <p className="micro-label mb-5">Outcome Tracking</p>
                  <div className="space-y-3">
                    <select
                      value={outcomeForm.domain}
                      onChange={(event) =>
                        setOutcomeForm((current) => ({ ...current, domain: event.target.value }))
                      }
                      className="h-11 w-full rounded-md border border-white/[0.08] bg-black/40 px-3 text-sm text-white/70 outline-none"
                    >
                      {["Recovery", "Movement", "Nutrition", "Metabolic", "Stress", "Sleep"].map((domain) => (
                        <option key={domain}>{domain}</option>
                      ))}
                    </select>
                    <input
                      value={outcomeForm.action}
                      onChange={(event) =>
                        setOutcomeForm((current) => ({ ...current, action: event.target.value }))
                      }
                      className="h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.025] px-3 text-sm text-white/70 outline-none"
                      placeholder="Action tested"
                    />
                    <select
                      value={outcomeForm.outcome}
                      onChange={(event) =>
                        setOutcomeForm((current) => ({ ...current, outcome: event.target.value }))
                      }
                      className="h-11 w-full rounded-md border border-white/[0.08] bg-black/40 px-3 text-sm text-white/70 outline-none"
                    >
                      <option value="success">Improved</option>
                      <option value="failure">Did not improve</option>
                      <option value="unknown">Still learning</option>
                    </select>
                    <textarea
                      value={outcomeForm.notes}
                      onChange={(event) =>
                        setOutcomeForm((current) => ({ ...current, notes: event.target.value }))
                      }
                      className="min-h-24 w-full resize-none rounded-md border border-white/[0.08] bg-white/[0.025] p-3 text-sm leading-6 text-white/70 outline-none"
                      placeholder="Before / after notes, symptom changes, adherence, or metric shift"
                    />
                    <button
                      type="button"
                      onClick={() => void saveOutcome()}
                      disabled={savingOutcome}
                      className="premium-action inline-flex h-11 w-full items-center justify-center rounded-md px-5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {savingOutcome ? "Saving outcome" : "Save outcome"}
                    </button>
                    {outcomeMessage && (
                      <p className="text-sm leading-6 text-white/45">{outcomeMessage}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="executive-panel rounded-lg p-6 md:p-7">
                <div className="mb-6 flex flex-col gap-4 border-b border-white/[0.06] pb-5 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="micro-label">Health Timeline</p>
                    <h2 className="mt-3 text-3xl font-light text-white">
                      Every signal in one chronology.
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {TYPE_FILTERS.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setActiveType(type)}
                        className={`rounded-md border px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] transition ${
                          activeType === type
                            ? "border-white/[0.2] bg-white/[0.07] royal-text"
                            : "border-white/[0.07] bg-white/[0.02] text-white/34 hover:text-white/60"
                        }`}
                      >
                        {type.replace(/_/g, " ")}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  {timeline.map((event) => (
                    <TimelineEventCard key={event.id} event={event} />
                  ))}
                  {!timeline.length && (
                    <EmptyState
                      eyebrow="No signals yet"
                      title="This part of the timeline is still quiet."
                      body="Add labs, connect wearable data, generate a protocol, or save an outcome and Aeonvera will begin filling this chronology."
                      action={{ href: "/optimization", label: "Create a signal" }}
                    />
                  )}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </PageContainer>
  );
}

function DigitalTwinIntelligencePanel({
  intelligence,
}: {
  intelligence: TwinIntelligence;
}) {
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="executive-panel rounded-lg p-6 md:p-7">
        <div className="mb-6 flex flex-col gap-4 border-b border-white/[0.06] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="micro-label">Twin Intelligence</p>
            <h2 className="mt-3 text-3xl font-light text-white">
              {intelligence.modelState} model.
            </h2>
          </div>
          <div className="premium-status-neutral rounded-md px-3 py-2 text-[10px] uppercase tracking-[0.14em]">
            {intelligence.confidence}% confidence
          </div>
        </div>
        <p className="text-xl font-light leading-8 text-white/78">
          {intelligence.summary}
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <SignalList title="What changed" items={intelligence.changes} empty="No metric movement yet." />
          <SignalList title="What worked" items={intelligence.worked} empty="Track an outcome to close the loop." />
        </div>
      </div>

      <Link
        href={intelligence.nextMove.href}
        className="quiet-lift executive-panel block rounded-lg p-6 transition hover:border-white/[0.14] md:p-7"
      >
        <div className="mb-6 flex items-center justify-between gap-3">
          <p className="micro-label">Next Best Move</p>
          <ArrowRight size={17} className="royal-text" />
        </div>
        <h3 className="text-3xl font-light leading-tight text-white">
          {intelligence.nextMove.title}
        </h3>
        <p className="mt-5 text-sm leading-7 text-white/48">
          {intelligence.nextMove.detail}
        </p>
      </Link>
    </div>
  );
}

function LivingTwinModelPanel({
  model,
  onRunProjection,
  projectionMessage,
  projectionResult,
  projectionSavedMessage,
  runningProjection,
}: {
  model: TwinModel;
  onRunProjection: (prompt: TwinScenarioPrompt) => Promise<void>;
  projectionMessage: string | null;
  projectionResult: TwinProjectionResult | null;
  projectionSavedMessage: string | null;
  runningProjection: string | null;
}) {
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="executive-panel rounded-lg p-6 md:p-7">
        <div className="mb-6 flex flex-col gap-4 border-b border-white/[0.06] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="micro-label">Living Twin Map</p>
            <h2 className="mt-3 text-3xl font-light text-white">
              {model.readiness.status}.
            </h2>
          </div>
          <div className="premium-status-neutral rounded-md px-3 py-2 text-[10px] uppercase tracking-[0.14em]">
            {model.readiness.score}% formed
          </div>
        </div>
        <p className="text-sm leading-7 text-white/50">
          {model.readiness.detail}
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {model.domains.map((domain) => (
            <div
              key={domain.label}
              className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-white/76">{domain.label}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-white/28">
                    {domain.status}
                  </p>
                </div>
                <p className="royal-text text-xl font-light">{domain.score}</p>
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-[rgb(var(--gold))]"
                  style={{ width: `${Math.max(8, Math.min(domain.score, 100))}%` }}
                />
              </div>
              <p className="mt-4 text-xs leading-5 text-white/38">{domain.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="executive-panel rounded-lg p-6 md:p-7">
        <div className="mb-6 border-b border-white/[0.06] pb-5">
          <p className="micro-label">Scenario Intelligence</p>
          <h2 className="mt-3 text-3xl font-light text-white">
            Questions the twin can now model.
          </h2>
        </div>
        <div className="space-y-3">
          {model.scenarioPrompts.map((prompt) => (
            <button
              key={prompt.question}
              type="button"
              onClick={() => void onRunProjection(prompt)}
              disabled={Boolean(runningProjection)}
              className="quiet-lift block w-full rounded-lg border border-white/[0.06] bg-white/[0.025] p-4 text-left transition hover:border-white/[0.14] disabled:cursor-not-allowed disabled:opacity-55"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm leading-6 text-white/76">{prompt.question}</p>
                  <p className="mt-2 text-xs leading-5 text-white/38">{prompt.detail}</p>
                  <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-white/24">
                    {prompt.scenarioIds.length} model lever{prompt.scenarioIds.length === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="mt-1 shrink-0 royal-text">
                  {runningProjection === prompt.question ? "Running" : "Run"}
                </span>
              </div>
            </button>
          ))}
          {!model.scenarioPrompts.length && (
            <EmptyState
              eyebrow="Scenario layer"
              title="The model needs one more signal."
              body="Add a future-self scenario, outcome, wearable trend, or clinical insight and Aeonvera will begin proposing simulations."
              action={{ href: "/optimization", label: "Create scenario" }}
            />
          )}
        </div>

        {(projectionMessage || projectionResult) && (
          <div className="mt-5 rounded-lg border border-[#dabc73]/20 bg-[#dabc73]/[0.055] p-5">
            <p className="micro-label">Projection Result</p>
            {projectionMessage && (
              <p className="mt-3 text-sm leading-6 text-white/52">{projectionMessage}</p>
            )}
            {projectionSavedMessage && (
              <p className="mt-2 text-xs uppercase tracking-[0.14em] royal-text">
                {projectionSavedMessage}
              </p>
            )}
            {projectionResult?.projection && (
              <>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <ProjectionMetric
                    label="Projected age"
                    value={projectionResult.projection.biologicalAge.toFixed(1)}
                    suffix="years"
                  />
                  <ProjectionMetric
                    label="Age separation"
                    value={projectionResult.projection.projectedBiologicalAgeImprovement.toFixed(1)}
                    suffix="years"
                  />
                  <ProjectionMetric
                    label="Twin score"
                    value={String(projectionResult.projection.score)}
                    suffix="score"
                  />
                </div>
                <p className="mt-5 text-sm leading-7 text-white/58">
                  {projectionResult.futureSelf?.summary ||
                    projectionResult.futureSelf?.headline ||
                    "Aeonvera projected this scenario against your current biological-age model."}
                </p>
                {projectionResult.futureSelf?.levers?.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {projectionResult.futureSelf.levers.slice(0, 4).map((lever) => (
                      <span
                        key={`${lever.label}-${lever.optimized}`}
                        className="rounded-md border border-white/[0.07] bg-black/20 px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-white/42"
                      >
                        {lever.label} / {lever.impact}
                      </span>
                    ))}
                  </div>
                ) : null}
                <Link
                  href="/optimization"
                  className="premium-action-secondary mt-5 inline-flex h-10 items-center justify-center rounded-md px-4 text-xs font-medium"
                >
                  Turn into protocol
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectionMetric({
  label,
  suffix,
  value,
}: {
  label: string;
  suffix: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-black/20 p-3">
      <p className="text-2xl font-light text-white/88">{value}</p>
      <p className="mt-1 text-[9px] uppercase tracking-[0.14em] text-white/28">
        {label} / {suffix}
      </p>
    </div>
  );
}

function SignalList({
  title,
  items,
  empty,
}: {
  title: string;
  items: TwinChange[];
  empty: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-4">
      <p className="mb-4 text-[10px] uppercase tracking-[0.14em] text-white/28">
        {title}
      </p>
      <div className="space-y-3">
        {items.length ? (
          items.map((item) => (
            <div key={`${title}-${item.metric}-${item.signal}`} className="border-t border-white/[0.05] pt-3 first:border-t-0 first:pt-0">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-white/70">{item.metric}</p>
                <span className={changeStatusClassName(item.direction)}>
                  {item.signal}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-white/38">{item.detail}</p>
            </div>
          ))
        ) : (
          <p className="text-sm leading-6 text-white/38">{empty}</p>
        )}
      </div>
    </div>
  );
}

function changeStatusClassName(direction: TwinChange["direction"]) {
  const base = "rounded-md px-2 py-1 text-[8px] uppercase tracking-[0.14em]";

  if (direction === "improving") return `${base} royal-text bg-white/[0.035]`;
  if (direction === "declining") return `${base} text-rose-200/70 bg-rose-400/[0.08]`;
  if (direction === "stable") return `${base} text-white/34 bg-white/[0.025]`;
  return `${base} text-white/28 bg-white/[0.02]`;
}

function TimelineEventCard({ event }: { event: TimelineEvent }) {
  const content = (
    <div className="quiet-lift rounded-lg border border-white/[0.06] bg-white/[0.025] p-4 transition hover:border-white/[0.14]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--gold))]" />
            <p className="text-sm text-white/74">{event.title}</p>
          </div>
          <p className="text-xs leading-5 text-white/38">{event.detail}</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs royal-text">{event.signal || event.type.replace(/_/g, " ")}</p>
          <p className="mt-1 text-[9px] uppercase tracking-[0.14em] text-white/22">
            {formatShortDate(event.occurred_at)}
          </p>
        </div>
      </div>
    </div>
  );

  return event.href ? <Link href={event.href}>{content}</Link> : content;
}

function buildSummaryCards(
  payload: DigitalTwinPayload,
  latestBioAge?: number | null
): Array<[string, string, string, LucideIcon]> {
  return [
    ["Bio age", latestBioAge ? `${latestBioAge}` : "--", "years", Dna],
    ["Protocols", `${payload.counts.protocols || 0}`, "generated", Sparkles],
    ["Signals", `${totalSignals(payload.counts)}`, "events", Activity],
    ["Updated", formatShortDate(payload.state?.updated_at), "model", Clock3],
  ];
}

function totalSignals(counts: Record<string, number>) {
  return Object.values(counts).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function formatShortDate(value?: string) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(date);
}
