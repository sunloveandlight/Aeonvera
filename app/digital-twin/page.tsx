"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, ArrowRight, Brain, Clock3, Dna, FileText, FlaskConical, HeartPulse, Sparkles, type LucideIcon } from "lucide-react";
import PageContainer from "@/components/ui/PageContainer";
import { supabase } from "@/lib/supabase/client";

type TimelineEvent = {
  id: string;
  type: "assessment" | "biological_age" | "lab" | "protocol" | "report" | "coach" | "scenario" | "wearable";
  title: string;
  detail: string;
  occurred_at: string;
  signal?: string;
  href?: string;
};

type DigitalTwinPayload = {
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
  timeline: TimelineEvent[];
  counts: Record<string, number>;
};

const TYPE_FILTERS: Array<TimelineEvent["type"] | "all"> = [
  "all",
  "biological_age",
  "protocol",
  "lab",
  "scenario",
  "wearable",
  "coach",
  "report",
  "assessment",
];

const MODEL_INPUTS: Array<[string, keyof DigitalTwinPayload["counts"], LucideIcon]> = [
  ["Assessments", "assessments", Brain],
  ["Biological age points", "biologicalAgePoints", HeartPulse],
  ["Clinical biomarkers", "labs", FlaskConical],
  ["Future scenarios", "scenarios", Dna],
  ["Reports", "reports", FileText],
];

export default function DigitalTwinPage() {
  const router = useRouter();
  const [payload, setPayload] = useState<DigitalTwinPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<TimelineEvent["type"] | "all">("all");

  useEffect(() => {
    let cancelled = false;

    async function loadTwin() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login?mode=signin");
        return;
      }

      try {
        const response = await fetch("/api/digital-twin/timeline", {
          credentials: "include",
        });
        const data = await response.json();

        if (!response.ok) {
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
  }, [router]);

  const timeline = useMemo(() => {
    const events = payload?.timeline || [];
    return activeType === "all"
      ? events
      : events.filter((event) => event.type === activeType);
  }, [activeType, payload]);

  const latestBioAge = payload?.profile?.biological_age;
  const insight = payload?.state?.insights?.[0] || "Your living health model is assembling from assessments, labs, protocols, coach signals, and wearable data.";

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
          <Link
            href="/optimization"
            className="premium-action inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium"
          >
            Optimize <ArrowRight size={16} />
          </Link>
        </div>

        {loading ? (
          <div className="executive-panel rounded-lg p-8">
            <p className="micro-label">Loading digital twin</p>
          </div>
        ) : message ? (
          <div className="executive-panel rounded-lg p-8">
            <p className="micro-label">Unavailable</p>
            <p className="mt-4 text-sm leading-7 text-white/50">{message}</p>
          </div>
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

            <div className="mt-6 grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
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
                    <p className="text-sm leading-7 text-white/42">
                      No events found for this filter yet.
                    </p>
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
