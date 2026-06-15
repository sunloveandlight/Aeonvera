"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, ArrowRight, Brain, Clock3, Dna, FileText, FlaskConical, HeartPulse, Printer, Sparkles, UsersRound, type LucideIcon } from "lucide-react";
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
  audit?: TwinAudit;
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

type TwinProjectionComparison = {
  actual?: string;
  actions?: string[];
  adjustment: {
    detail: string;
    title: string;
  };
  confidence: number;
  detail: string;
  evidenceMissing: string[];
  followUpQuestion: string;
  linkedProtocol?: string;
  projected?: string;
  status: "pending" | "tracking" | "on_track" | "off_track";
  title: string;
};

type TwinModel = {
  domains: TwinDomain[];
  projectionComparisons: TwinProjectionComparison[];
  readiness: {
    detail: string;
    score: number;
    status: string;
  };
  scenarioPrompts: TwinScenarioPrompt[];
};

type TwinAudit = {
  blindSpots: Array<{
    actionHref: string;
    detail: string;
    label: string;
  }>;
  evidencePriorities: string[];
  freshness: {
    detail: string;
    label: string;
    status: "current" | "warming" | "stale";
    updatedAt?: string;
  };
  recommendationReason: string;
};

type TwinProjectionResult = {
  activeScenarioIds?: string[];
  baseline?: {
    accuracyScore?: number;
    ageDelta?: number;
    biologicalAge: number;
    category?: string;
    chronologicalAge?: number;
    score: number;
  };
  controls?: Record<string, number>;
  futureSelf?: {
    headline?: string;
    summary?: string;
    levers?: Array<{
      current?: number;
      delta?: number;
      direction?: "increase" | "decrease";
      impact: "low" | "medium" | "high";
      key?: string;
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

type ProjectionLever = NonNullable<
  NonNullable<TwinProjectionResult["futureSelf"]>["levers"]
>[number];

type SavedProjectionScenario = {
  id?: string;
  protocol_id?: string | null;
  share_token?: string | null;
  title?: string | null;
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
  const [projectionProtocolMessage, setProjectionProtocolMessage] = useState<string | null>(null);
  const [projectionSavedMessage, setProjectionSavedMessage] = useState<string | null>(null);
  const [projectionScenario, setProjectionScenario] = useState<SavedProjectionScenario | null>(null);
  const [customWhatIf, setCustomWhatIf] = useState("");
  const [generatingProjectionProtocol, setGeneratingProjectionProtocol] = useState(false);
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
  const timelinePreview = useMemo(() => timeline.slice(0, 12), [timeline]);
  const hiddenTimelineCount = Math.max(0, timeline.length - timelinePreview.length);
  const timelineTypeSummary = useMemo(() => summarizeTimelineTypes(timeline), [timeline]);

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
    setProjectionProtocolMessage(null);
    setProjectionSavedMessage(null);
    setProjectionResult(null);
    setProjectionScenario(null);

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

      const savedScenario = saved?.scenario as SavedProjectionScenario | undefined;
      setProjectionScenario(savedScenario || null);
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

  async function runCustomWhatIf() {
    const question = customWhatIf.trim();

    if (!question) {
      setProjectionMessage("Ask the twin what you want to model first.");
      return;
    }

    const prompt = buildCustomTwinPrompt(question);
    await runTwinProjection(prompt);
  }

  async function buildProtocolFromProjection() {
    if (!projectionResult?.projection || !projectionResult.controls) {
      setProjectionProtocolMessage("Run a projection before generating a linked protocol.");
      return;
    }

    setGeneratingProjectionProtocol(true);
    setProjectionProtocolMessage(null);

    try {
      const projectionTitle = projectionScenario?.title || "Digital Twin projection";
      const levers =
        projectionResult.futureSelf?.levers
          ?.slice(0, 4)
          .map((lever) => `${lever.label}: ${lever.impact} impact`)
          .join("; ") || "Selected simulation levers";

      const response = await fetch("/api/optimization/protocol", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          answers: {
            priority: projectionTitle,
            sleep: "Use sleep and recovery levers only when they support the projected path.",
            nutrition: "Support the projected biological-age separation with realistic nutrition execution.",
            training: "Build training cadence from the selected simulator levers.",
            metabolic: "Track biomarkers and biological-age movement against the projection.",
            stress: "Reduce friction so the projection can survive real life.",
          },
          questions: [
            {
              id: "priority",
              domain: "Digital Twin",
              prompt: "What should this protocol optimize?",
              options: [projectionTitle],
            },
            {
              id: "sleep",
              domain: "Recovery",
              prompt: "How should recovery support this projection?",
              options: ["Use sleep and recovery levers only when they support the projected path."],
            },
            {
              id: "nutrition",
              domain: "Nutrition",
              prompt: "How should nutrition support this projection?",
              options: ["Support the projected biological-age separation with realistic nutrition execution."],
            },
            {
              id: "training",
              domain: "Training",
              prompt: "How should training support this projection?",
              options: ["Build training cadence from the selected simulator levers."],
            },
            {
              id: "metabolic",
              domain: "Biomarkers",
              prompt: "What should be measured?",
              options: ["Track biomarkers and biological-age movement against the projection."],
            },
            {
              id: "stress",
              domain: "Stress",
              prompt: "What should the protocol avoid?",
              options: ["Reduce friction so the projection can survive real life."],
            },
          ],
          context: [
            `Digital Twin scenario: ${projectionTitle}.`,
            `Projected biological age: ${projectionResult.projection.biologicalAge.toFixed(1)} years.`,
            `Projected biological-age improvement: ${projectionResult.projection.projectedBiologicalAgeImprovement.toFixed(1)} years.`,
            `Model score target: ${projectionResult.projection.score}.`,
            `Primary levers: ${levers}.`,
          ].join(" "),
          projectionContext: {
            controls: projectionResult.controls,
            projection: projectionResult.projection,
          },
          sourceScenarioShareToken: projectionScenario?.share_token || undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not generate a linked protocol.");
      }

      setProjectionScenario((current) => ({
        ...(current || {}),
        protocol_id: data.protocol?.id || current?.protocol_id || null,
      }));
      setProjectionProtocolMessage(
        "Linked protocol generated. Aeonvera can now compare the projection, the actions, and the outcomes together."
      );

      const timelineResponse = await fetch("/api/digital-twin/timeline", {
        credentials: "include",
      });
      const timelineData = await timelineResponse.json();
      if (timelineResponse.ok) setPayload(timelineData);
    } catch (error) {
      setProjectionProtocolMessage(
        error instanceof Error ? error.message : "Could not generate a linked protocol."
      );
    } finally {
      setGeneratingProjectionProtocol(false);
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
            <Link
              href="/network"
              className="premium-action-secondary inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium"
            >
              Network <UsersRound size={16} />
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
              {buildSummaryCards(payload, latestBioAge).map((card) => (
                <TwinSummaryCard key={card.label} card={card} />
              ))}
            </div>

            {payload.intelligence && (
              <DigitalTwinIntelligencePanel intelligence={payload.intelligence} />
            )}

            {payload.audit && (
              <DigitalTwinAuditPanel audit={payload.audit} />
            )}

            {payload.model && (
              <LivingTwinModelPanel
                model={payload.model}
                projectionMessage={projectionMessage}
                projectionProtocolMessage={projectionProtocolMessage}
                projectionResult={projectionResult}
                projectionSavedMessage={projectionSavedMessage}
                projectionScenario={projectionScenario}
                customWhatIf={customWhatIf}
                generatingProjectionProtocol={generatingProjectionProtocol}
                onBuildProtocol={buildProtocolFromProjection}
                onCustomWhatIfChange={setCustomWhatIf}
                onRunCustomWhatIf={runCustomWhatIf}
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
                      Latest meaningful changes.
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-white/42">
                      Aeonvera is showing the newest signal clusters first. Older entries stay in
                      the model without overwhelming the page.
                    </p>
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

                {timeline.length ? (
                  <div className="mb-5 grid gap-3 sm:grid-cols-3">
                    {timelineTypeSummary.map(([type, count]) => (
                      <div
                        key={type}
                        className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-3"
                      >
                        <p className="text-[9px] uppercase tracking-[0.14em] text-white/24">
                          {type.replace(/_/g, " ")}
                        </p>
                        <p className="mt-2 text-xl font-light leading-none text-white/78">
                          {count}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="space-y-3">
                  {timelinePreview.map((event) => (
                    <TimelineEventCard key={event.id} event={event} />
                  ))}
                  {hiddenTimelineCount > 0 ? (
                    <div className="rounded-lg border border-white/[0.06] bg-black/20 p-4 text-center">
                      <p className="text-sm text-white/52">
                        {hiddenTimelineCount} older signal{hiddenTimelineCount === 1 ? "" : "s"} are
                        folded into the model.
                      </p>
                      <p className="mt-2 text-xs leading-5 text-white/32">
                        Use the filters above to inspect a specific signal type without turning the
                        page into a raw event log.
                      </p>
                    </div>
                  ) : null}
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

function DigitalTwinAuditPanel({ audit }: { audit: TwinAudit }) {
  return (
    <div className="mt-6 executive-panel rounded-lg p-6 md:p-7">
      <div className="mb-6 flex flex-col gap-4 border-b border-white/[0.06] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="micro-label">Model Audit</p>
          <h2 className="mt-3 text-3xl font-light text-white">
            What the twin trusts right now.
          </h2>
        </div>
        <div className={freshnessClassName(audit.freshness.status)}>
          {audit.freshness.label}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-5">
          <p className="micro-label">Why Aeonvera recommends this</p>
          <p className="mt-4 text-sm leading-7 text-white/62">
            {audit.recommendationReason}
          </p>
          <div className="mt-5 rounded-lg border border-white/[0.055] bg-black/20 p-4">
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/28">
              Evidence freshness
            </p>
            <p className="mt-3 text-sm leading-6 text-white/58">
              {audit.freshness.detail}
            </p>
            {audit.freshness.updatedAt && (
              <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-white/24">
                Latest signal {formatShortDate(audit.freshness.updatedAt)}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-5">
            <p className="micro-label">Blind Spots</p>
            <div className="mt-4 space-y-3">
              {audit.blindSpots.length ? (
                audit.blindSpots.map((spot) => (
                  <Link
                    key={spot.label}
                    href={spot.actionHref}
                    className="quiet-lift block rounded-lg border border-white/[0.055] bg-black/20 p-3 transition hover:border-white/[0.14]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-white/72">{spot.label}</p>
                        <p className="mt-2 text-xs leading-5 text-white/38">
                          {spot.detail}
                        </p>
                      </div>
                      <ArrowRight size={14} className="mt-0.5 shrink-0 royal-text" />
                    </div>
                  </Link>
                ))
              ) : (
                <p className="text-sm leading-6 text-white/42">
                  The model has enough signal for the current recommendation layer.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-5">
            <p className="micro-label">Next Evidence</p>
            <div className="mt-4 space-y-3">
              {audit.evidencePriorities.length ? (
                audit.evidencePriorities.map((priority) => (
                  <div
                    key={priority}
                    className="rounded-lg border border-white/[0.055] bg-black/20 p-3"
                  >
                    <p className="text-xs leading-5 text-white/48">{priority}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-6 text-white/42">
                  Keep executing and logging outcomes. The next improvement is higher signal density, not more complexity.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LivingTwinModelPanel({
  customWhatIf,
  generatingProjectionProtocol,
  model,
  onBuildProtocol,
  onCustomWhatIfChange,
  onRunCustomWhatIf,
  onRunProjection,
  projectionMessage,
  projectionProtocolMessage,
  projectionResult,
  projectionSavedMessage,
  projectionScenario,
  runningProjection,
}: {
  customWhatIf: string;
  generatingProjectionProtocol: boolean;
  model: TwinModel;
  onBuildProtocol: () => Promise<void>;
  onCustomWhatIfChange: (value: string) => void;
  onRunCustomWhatIf: () => Promise<void>;
  onRunProjection: (prompt: TwinScenarioPrompt) => Promise<void>;
  projectionMessage: string | null;
  projectionProtocolMessage: string | null;
  projectionResult: TwinProjectionResult | null;
  projectionSavedMessage: string | null;
  projectionScenario: SavedProjectionScenario | null;
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

        <ProjectionRealityPanel comparisons={model.projectionComparisons} />
      </div>

      <div className="executive-panel rounded-lg p-6 md:p-7">
        <div className="mb-6 border-b border-white/[0.06] pb-5">
          <p className="micro-label">Scenario Intelligence</p>
          <h2 className="mt-3 text-3xl font-light text-white">
            Ask what your future self becomes.
          </h2>
        </div>

        <div className="mb-5 rounded-lg border border-[#dabc73]/18 bg-[#dabc73]/[0.045] p-4">
          <label htmlFor="digital-twin-what-if" className="micro-label">
            Ask What If
          </label>
          <textarea
            id="digital-twin-what-if"
            value={customWhatIf}
            onChange={(event) => onCustomWhatIfChange(event.target.value)}
            className="mt-3 min-h-24 w-full resize-none rounded-md border border-white/[0.08] bg-black/20 p-3 text-sm leading-6 text-white/72 outline-none placeholder:text-white/24"
            placeholder="What happens if I stop alcohol, add Zone 2 three times a week, and sleep 45 minutes longer?"
          />
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-white/38">
              Aeonvera converts your question into model levers, saves the projection, then can turn it into a protocol.
            </p>
            <button
              type="button"
              onClick={() => void onRunCustomWhatIf()}
              disabled={Boolean(runningProjection)}
              className="premium-action inline-flex h-10 shrink-0 items-center justify-center rounded-md px-4 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-55"
            >
              {runningProjection === customWhatIf.trim() ? "Modeling" : "Model this"}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <p className="micro-label">Suggested Models</p>
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
                <ProjectionAssumptionsPanel
                  model={model}
                  projectionResult={projectionResult}
                />
                <button
                  type="button"
                  onClick={() => void onBuildProtocol()}
                  disabled={generatingProjectionProtocol}
                  className="premium-action-secondary mt-5 inline-flex h-10 items-center justify-center rounded-md px-4 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {generatingProjectionProtocol
                    ? "Generating protocol"
                    : projectionScenario?.protocol_id
                      ? "Regenerate linked protocol"
                      : "Generate linked protocol"}
                </button>
                {projectionProtocolMessage && (
                  <p className="mt-3 text-xs leading-5 text-white/48">
                    {projectionProtocolMessage}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectionAssumptionsPanel({
  model,
  projectionResult,
}: {
  model: TwinModel;
  projectionResult: TwinProjectionResult;
}) {
  const levers = projectionResult.futureSelf?.levers || [];
  const visibleLevers = levers.slice(0, 5);
  const sensitiveLever = pickSensitiveLever(levers);
  const confidence = buildProjectionConfidence(model, projectionResult);
  const missingData = buildProjectionMissingData(model, projectionResult);
  const realityCheck = buildProjectionRealityCheck(model, projectionResult);

  return (
    <div className="mt-5 rounded-lg border border-white/[0.06] bg-black/20 p-4">
      <div className="mb-4 flex flex-col gap-3 border-b border-white/[0.045] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="micro-label">Twin Assumptions</p>
          <p className="mt-2 text-xs leading-5 text-white/40">
            Aeonvera is showing the assumptions behind this projection so the model feels inspectable, not mysterious.
          </p>
        </div>
        <span className="premium-status-neutral rounded-md px-3 py-2 text-[10px] uppercase tracking-[0.14em]">
          {confidence.score}% confidence
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-white/[0.055] bg-white/[0.022] p-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/28">
            What changed
          </p>
          <div className="mt-3 space-y-2">
            {visibleLevers.length ? (
              visibleLevers.map((lever) => (
                <p key={`${lever.label}-${lever.optimized}`} className="text-xs leading-5 text-white/44">
                  {lever.label}: {formatProjectionValue(lever.current)} to {formatProjectionValue(lever.optimized)}
                </p>
              ))
            ) : (
              <p className="text-xs leading-5 text-white/36">
                Aeonvera used the selected scenario levers without a detailed lever map.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-white/[0.055] bg-white/[0.022] p-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/28">
            Most sensitive lever
          </p>
          <p className="mt-3 text-sm leading-6 text-white/62">
            {sensitiveLever
              ? `${sensitiveLever.label} is carrying the strongest modeled effect.`
              : "The model needs another scenario run to isolate the strongest lever."}
          </p>
          {sensitiveLever && (
            <p className="mt-2 text-xs leading-5 text-white/36">
              Modeled shift: {formatProjectionValue(sensitiveLever.current)} to {formatProjectionValue(sensitiveLever.optimized)}.
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <ProjectionIntelligenceTile
          label="Confidence"
          value={confidence.label}
          detail={confidence.detail}
        />
        <ProjectionIntelligenceTile
          label="Reality check"
          value={realityCheck.label}
          detail={realityCheck.detail}
        />
        <ProjectionIntelligenceTile
          label="Missing data"
          value={`${missingData.length} signal${missingData.length === 1 ? "" : "s"}`}
          detail={missingData.slice(0, 2).join(" and ") || "Enough signal exists for an initial projection."}
        />
      </div>
    </div>
  );
}

function ProjectionIntelligenceTile({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.055] bg-white/[0.022] p-3">
      <p className="text-[10px] uppercase tracking-[0.14em] text-white/28">{label}</p>
      <p className="mt-3 text-sm text-white/66">{value}</p>
      <p className="mt-2 text-xs leading-5 text-white/36">{detail}</p>
    </div>
  );
}

function buildProjectionConfidence(
  model: TwinModel,
  projectionResult: TwinProjectionResult
) {
  const baselineAccuracy = projectionResult.baseline?.accuracyScore || 0;
  const leverCount = projectionResult.futureSelf?.levers?.length || 0;
  const score = Math.max(
    28,
    Math.min(
      94,
      Math.round(model.readiness.score * 0.55 + baselineAccuracy * 0.25 + Math.min(leverCount, 5) * 4)
    )
  );
  const label = score >= 78 ? "High" : score >= 58 ? "Moderate" : "Early";
  const detail =
    score >= 78
      ? "The twin has enough longitudinal signal to treat this as a strong planning model."
      : score >= 58
        ? "Useful for direction, but outcomes and repeat measurements will sharpen it."
        : "Best used as a first-pass simulation until more live data arrives.";

  return { detail, label, score };
}

function buildProjectionMissingData(
  model: TwinModel,
  projectionResult: TwinProjectionResult
) {
  const missing: string[] = [];
  const byLabel = new Map(model.domains.map((domain) => [domain.label, domain]));

  if ((byLabel.get("Clinical")?.score || 0) < 55) missing.push("fresh labs");
  if ((byLabel.get("Recovery")?.score || 0) < 55) missing.push("wearable sleep and HRV");
  if ((byLabel.get("Execution")?.score || 0) < 55) missing.push("tracked outcomes");
  if (!projectionResult.baseline?.accuracyScore || projectionResult.baseline.accuracyScore < 70) {
    missing.push("stronger assessment accuracy");
  }

  return Array.from(new Set(missing)).slice(0, 4);
}

function buildProjectionRealityCheck(
  model: TwinModel,
  projectionResult: TwinProjectionResult
) {
  const highImpactLevers =
    projectionResult.futureSelf?.levers?.filter((lever) => lever.impact === "high").length || 0;
  const executionScore =
    model.domains.find((domain) => domain.label === "Execution")?.score || 0;

  if (executionScore >= 70 && highImpactLevers <= 2) {
    return {
      label: "Realistic",
      detail: "The projected path matches the current execution layer and does not depend on too many difficult shifts.",
    };
  }

  if (executionScore >= 45 || highImpactLevers <= 2) {
    return {
      label: "Plausible",
      detail: "The projection is usable, but Aeonvera should convert it into a low-friction protocol before trusting it.",
    };
  }

  return {
    label: "Ambitious",
    detail: "This scenario asks for several strong behavior shifts. The protocol should start smaller and earn intensity.",
  };
}

function pickSensitiveLever(levers: ProjectionLever[] = []) {
  return levers
    .slice()
    .sort((a, b) => leverWeight(b) - leverWeight(a))[0];
}

function leverWeight(lever: ProjectionLever) {
  const impactWeight = lever.impact === "high" ? 3 : lever.impact === "medium" ? 2 : 1;
  return impactWeight * 10 + Math.abs(Number(lever.delta) || 0);
}

function formatProjectionValue(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "unknown";
  return Math.abs(numeric) >= 10 ? String(Math.round(numeric)) : numeric.toFixed(1);
}

function buildCustomTwinPrompt(question: string): TwinScenarioPrompt {
  const normalized = question.toLowerCase();
  const scenarioIds = new Set<string>();

  if (/sleep|bed|wake|insomnia|rest|recovery|rem|deep|nap/.test(normalized)) {
    scenarioIds.add("sleep-30");
  }

  if (/zone 2|vo2|cardio|aerobic|run|running|bike|cycling|walk|walking|steps|heart|hrv|resting heart/.test(normalized)) {
    scenarioIds.add("vo2-15");
  }

  if (/lift|lifting|strength|resistance|muscle|training|workout|gym|exercise/.test(normalized)) {
    scenarioIds.add("training-consistency");
  }

  if (/weight|fat|lean|waist|body composition|pounds|lbs|kg|metabolic|glucose|insulin|a1c|hba1c|triglyceride|alcohol|drinking|sugar|carb|protein/.test(normalized)) {
    scenarioIds.add("lose-20-pounds");
  }

  if (/stress|cortisol|anxiety|burnout|meditation|breath|breathing|sauna|cold|red light|pemf|hyperbaric|recovery|alcohol|caffeine/.test(normalized)) {
    scenarioIds.add("stress-reset");
  }

  if (!scenarioIds.size) {
    scenarioIds.add("sleep-30");
    scenarioIds.add("training-consistency");
  }

  return {
    question,
    detail: `Custom Digital Twin question interpreted as ${scenarioIds.size} model lever${scenarioIds.size === 1 ? "" : "s"}.`,
    href: "/digital-twin",
    scenarioIds: Array.from(scenarioIds).slice(0, 5),
  };
}

function ProjectionRealityPanel({
  comparisons,
}: {
  comparisons: TwinProjectionComparison[];
}) {
  return (
    <div className="mt-6 rounded-lg border border-white/[0.06] bg-black/20 p-5">
      <div className="mb-4 flex flex-col gap-2 border-b border-white/[0.05] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="micro-label">Projection vs Reality</p>
          <p className="mt-2 text-sm text-white/58">
            Aeonvera compares saved simulations against actual outcomes as new data arrives.
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-[0.14em] text-white/28">
          {comparisons.length ? `${comparisons.length} tracked` : "Waiting"}
        </span>
      </div>

      <div className="space-y-3">
        {comparisons.length ? (
          comparisons.map((comparison) => (
            <div
              key={`${comparison.title}-${comparison.projected || comparison.actual || comparison.status}`}
              className="rounded-lg border border-white/[0.055] bg-white/[0.022] p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm text-white/76">{comparison.title}</p>
                  <p className="mt-2 text-xs leading-5 text-white/40">{comparison.detail}</p>
                </div>
                <span className={projectionStatusClassName(comparison.status)}>
                  {comparison.status.replace(/_/g, " ")}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-md border border-white/[0.07] bg-black/20 px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-white/46">
                  {comparison.confidence}% confidence
                </span>
                {comparison.projected && (
                  <span className="rounded-md border border-[#dabc73]/18 bg-[#dabc73]/[0.055] px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] royal-text">
                    {comparison.projected}
                  </span>
                )}
                {comparison.actual && (
                  <span className="rounded-md border border-white/[0.07] bg-black/20 px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-white/46">
                    {comparison.actual}
                  </span>
                )}
                {comparison.linkedProtocol && (
                  <span className="rounded-md border border-white/[0.07] bg-black/20 px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-white/46">
                    linked protocol
                  </span>
                )}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-white/[0.05] bg-black/20 p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/28">
                    Follow-up question
                  </p>
                  <p className="mt-2 text-xs leading-5 text-white/48">
                    {comparison.followUpQuestion}
                  </p>
                </div>
                <div className="rounded-lg border border-white/[0.05] bg-black/20 p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/28">
                    Auto-adjust
                  </p>
                  <p className="mt-2 text-xs leading-5 text-white/58">
                    {comparison.adjustment.title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-white/36">
                    {comparison.adjustment.detail}
                  </p>
                </div>
              </div>
              {comparison.evidenceMissing.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {comparison.evidenceMissing.map((item) => (
                    <span
                      key={`${comparison.title}-${item}`}
                      className="rounded-md border border-rose-300/[0.12] bg-rose-400/[0.045] px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-rose-100/52"
                    >
                      needs {item}
                    </span>
                  ))}
                </div>
              ) : null}
              {comparison.actions?.length ? (
                <div className="mt-3 space-y-2 border-t border-white/[0.045] pt-3">
                  {comparison.actions.map((action) => (
                    <p key={`${comparison.title}-${action}`} className="text-[11px] leading-5 text-white/38">
                      {action}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <p className="text-sm leading-6 text-white/38">
            Run and save a projection, then add outcomes or another biological-age update. Aeonvera will begin comparing the simulation against reality here.
          </p>
        )}
      </div>
    </div>
  );
}

function projectionStatusClassName(status: TwinProjectionComparison["status"]) {
  const base = "rounded-md px-2 py-1 text-[8px] uppercase tracking-[0.14em]";

  if (status === "on_track") return `${base} royal-text bg-[#dabc73]/[0.08]`;
  if (status === "off_track") return `${base} text-rose-200/70 bg-rose-400/[0.08]`;
  if (status === "tracking") return `${base} text-white/50 bg-white/[0.045]`;
  return `${base} text-white/28 bg-white/[0.025]`;
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

function freshnessClassName(status: TwinAudit["freshness"]["status"]) {
  const base = "rounded-md px-3 py-2 text-[10px] uppercase tracking-[0.14em]";

  if (status === "current") return `${base} royal-text bg-[#dabc73]/[0.08]`;
  if (status === "warming") return `${base} text-white/52 bg-white/[0.045]`;
  return `${base} text-rose-200/70 bg-rose-400/[0.08]`;
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

type TwinSummaryCardData = {
  Icon: LucideIcon;
  label: string;
  suffix: string;
  value: string;
};

function TwinSummaryCard({ card }: { card: TwinSummaryCardData }) {
  const { Icon, label, suffix, value } = card;

  return (
    <div className="executive-panel grid min-h-[10.5rem] grid-rows-[auto_1fr] rounded-lg p-5">
      <div className="flex min-h-8 items-start justify-between gap-3">
        <p className="micro-label max-w-[9rem] leading-4">{label}</p>
        <Icon size={17} className="mt-0.5 shrink-0 royal-text" />
      </div>

      <div className="mt-6 flex h-full flex-col justify-end">
        <p className="tabular-nums text-4xl font-light leading-none text-white/88">
          {value}
        </p>
        <p className="mt-2 min-h-4 text-xs uppercase tracking-[0.14em] text-white/24">
          {suffix}
        </p>
      </div>
    </div>
  );
}

function buildSummaryCards(
  payload: DigitalTwinPayload,
  latestBioAge?: number | null
): TwinSummaryCardData[] {
  return [
    { Icon: Dna, label: "Bio age", suffix: "years", value: latestBioAge ? `${latestBioAge}` : "--" },
    { Icon: Sparkles, label: "Protocols", suffix: "generated", value: `${payload.counts.protocols || 0}` },
    { Icon: Activity, label: "Signals", suffix: "events", value: `${totalSignals(payload.counts)}` },
    { Icon: Clock3, label: "Updated", suffix: "model", value: formatShortDate(payload.state?.updated_at) },
  ];
}

function summarizeTimelineTypes(events: TimelineEvent[]): Array<[TimelineEvent["type"], number]> {
  const counts = events.reduce<Partial<Record<TimelineEvent["type"], number>>>(
    (summary, event) => ({
      ...summary,
      [event.type]: (summary[event.type] || 0) + 1,
    }),
    {}
  );

  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3) as Array<[TimelineEvent["type"], number]>;
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
