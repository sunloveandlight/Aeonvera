"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Brain, Clock, MessageCircle, Target, Trash2 } from "lucide-react";
import PageContainer from "@/components/ui/PageContainer";
import AccessState, { EmptyState } from "@/components/ui/AccessState";
import NextBestAction from "@/components/ui/NextBestAction";
import { supabase } from "@/lib/supabase/client";

type CoachMemory = {
  communicationStyle?: string;
  motivationProfile?: {
    primaryDriver?: string;
    needs?: string;
  };
  failurePatterns?: Array<{ label: string; count: number; actions?: string[] }>;
  bestInterventions?: Array<{ domain: string; action: string; successCount: number }>;
  domainScores?: Record<string, number>;
  morningBrief?: string;
  confidence?: number;
  lastComputedAt?: string;
};

type AgentPreference = {
  id: string;
  category: string;
  preference_key: string;
  preference_value: string;
  source: string;
  confidence: number | string;
  updated_at: string;
};

type SemanticMemory = {
  id: string;
  source_type: string;
  title: string | null;
  content: string;
  importance: number | string;
  memory_kind?: string | null;
  confidence?: number | string | null;
  is_pinned?: boolean | null;
  occurred_at: string | null;
  created_at: string;
};

export default function MemoryPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [memory, setMemory] = useState<CoachMemory | null>(null);
  const [preferences, setPreferences] = useState<AgentPreference[]>([]);
  const [semanticMemories, setSemanticMemories] = useState<SemanticMemory[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadMemory() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) {
          setAuthenticated(false);
          setLoading(false);
        }
        return;
      }

      const [memoryResponse, preferencesResponse, semanticMemoryResponse] = await Promise.all([
        fetch("/api/coach/memory", { credentials: "include" }),
        fetch("/api/agent/preferences", { credentials: "include" }),
        fetch("/api/memory/semantic?limit=12", { credentials: "include" }),
      ]);
      const [memoryData, preferencesData, semanticMemoryData] = await Promise.all([
        memoryResponse.json().catch(() => null),
        preferencesResponse.json().catch(() => null),
        semanticMemoryResponse.json().catch(() => null),
      ]);

      if (cancelled) return;

      setAuthenticated(true);
      setLocked(memoryResponse.status === 403 || preferencesResponse.status === 403);
      setMemory(memoryResponse.ok ? memoryData?.memory || null : null);
      setPreferences(preferencesResponse.ok ? preferencesData?.preferences || [] : []);
      setSemanticMemories(
        semanticMemoryResponse.ok && Array.isArray(semanticMemoryData?.memories)
          ? semanticMemoryData.memories as SemanticMemory[]
          : []
      );
      setMessage(memoryData?.message || preferencesData?.message || null);
      setLoading(false);
    }

    void loadMemory();

    return () => {
      cancelled = true;
    };
  }, []);

  const confidence = Math.round((memory?.confidence || 0) * 100);
  const groupedPreferences = useMemo(() => groupPreferences(preferences), [preferences]);
  const memoryNextAction = buildMemoryNextAction({
    confidence,
    preferencesCount: preferences.length,
    semanticMemoryCount: semanticMemories.length,
  });

  async function forgetSemanticMemory(id: string) {
    setSemanticMemories((current) => current.filter((memory) => memory.id !== id));
    const response = await fetch("/api/memory/semantic", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ids: [id] }),
    });
    if (!response.ok) {
      setMessage("Aeonvera could not forget that memory yet. Try again in a moment.");
    }
  }

  async function forgetAllSemanticMemories() {
    if (!semanticMemories.length) return;
    const confirmed = window.confirm(
      "Forget all long-term semantic memories? Your account, reports, and source health data stay intact."
    );
    if (!confirmed) return;

    const previous = semanticMemories;
    setSemanticMemories([]);
    const response = await fetch("/api/memory/semantic", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ all: true }),
    });

    if (!response.ok) {
      setSemanticMemories(previous);
      setMessage("Aeonvera could not forget all memories yet. Try again in a moment.");
      return;
    }

    setMessage("Long-term semantic memories forgotten.");
  }

  function exportSemanticMemories() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            semanticMemories,
            preferences,
            coachMemory: memory,
          },
          null,
          2
        ),
      ],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `aeonvera-memory-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="py-14">
          <AccessState
            eyebrow="Agent Memory"
            title="Reading the personal model."
            body="Aeonvera is loading coaching style, execution patterns, and remembered preferences."
            actions={[]}
          />
        </div>
      </PageContainer>
    );
  }

  if (authenticated === false) {
    return (
      <PageContainer>
        <div className="py-14">
          <AccessState
            eyebrow="Agent Memory"
            title="Sign in to view what Aeonvera knows."
            body="Your memory model belongs inside your private account."
            actions={[{ href: "/login?mode=signin", label: "Sign in" }]}
          />
        </div>
      </PageContainer>
    );
  }

  if (locked) {
    return (
      <PageContainer>
        <div className="py-14">
          <AccessState
            eyebrow="Agent Memory"
            title="Adaptive memory unlocks with Elite."
            body="Persistent preferences, coaching style, and proactive personalization are part of the higher intelligence tiers."
            actions={[{ href: "/pricing", label: "View plans" }]}
          />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="py-14 md:py-16">
        <section className="executive-panel rounded-lg p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="micro-label">Agent Memory</p>
              <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-tight text-white sm:text-5xl md:text-6xl">
                What Aeonvera is learning about you.
              </h1>
              <p className="mt-5 max-w-3xl text-sm leading-7 text-white/52">
                Preferences, friction patterns, motivation style, and interventions that appear to work for your real life.
              </p>
              {message ? <p className="mt-4 text-sm leading-6 royal-text">{message}</p> : null}
            </div>
            <Link
              href="/companion"
              className="premium-action inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium"
            >
              Open Companion
              <ArrowRight size={15} />
            </Link>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          <MemoryMetric label="Style" value={styleLabel(memory?.communicationStyle)} detail="coaching voice" />
          <MemoryMetric label="Confidence" value={`${confidence || 0}%`} detail="memory certainty" />
          <MemoryMetric label="Preferences" value={preferences.length.toString()} detail="explicitly learned" />
          <MemoryMetric label="Updated" value={formatFreshness(memory?.lastComputedAt)} detail="last model refresh" />
        </section>

        <NextBestAction
          className="mt-6"
          title={memoryNextAction.title}
          body={memoryNextAction.body}
          actionLabel={memoryNextAction.actionLabel}
          href={memoryNextAction.href}
          secondaryHref="/data-sources"
          secondaryLabel="Add data"
        />

        <section className="mt-6 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="executive-panel rounded-lg p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <p className="micro-label">Private Coaching Model</p>
              <Brain size={18} className="royal-text" />
            </div>
            <h2 className="text-2xl font-semibold leading-tight text-white/88">
              {memory?.morningBrief ||
                "Aeonvera is still building the shape of your coaching model."}
            </h2>
            <p className="mt-4 text-sm leading-7 text-white/42">
              {memory?.motivationProfile?.needs ||
                "Use the companion, voice assistant, and execution feedback so Aeonvera can learn what genuinely changes behavior."}
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <MemoryStat
                label="Driver"
                value={memory?.motivationProfile?.primaryDriver || "Small wins"}
                detail="current motivation model"
              />
              <MemoryStat
                label="Friction"
                value={memory?.failurePatterns?.[0]?.label || "Learning"}
                detail={memory?.failurePatterns?.[0] ? `${memory.failurePatterns[0].count} signals` : "no pattern yet"}
              />
              <MemoryStat
                label="Strongest"
                value={memory?.bestInterventions?.[0]?.domain || "Learning"}
                detail={memory?.bestInterventions?.[0] ? `${memory.bestInterventions[0].successCount} responses` : "no pattern yet"}
              />
            </div>
          </div>

          <div className="executive-panel rounded-lg p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <p className="micro-label">Best Interventions</p>
              <Target size={18} className="royal-text" />
            </div>
            {memory?.bestInterventions?.length ? (
              <div className="space-y-3">
                {memory.bestInterventions.slice(0, 4).map((item) => (
                  <div key={`${item.domain}-${item.action}`} className="av-surface rounded-lg p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-sm">{item.domain}</p>
                      <span className="av-chip-control av-eyebrow px-2 py-1">
                        {item.successCount} responses
                      </span>
                    </div>
                    <p className="av-muted text-xs leading-5">{item.action}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No strongest pattern yet"
                body="Complete, skip, and reschedule actions so Aeonvera can learn what actually works."
              />
            )}
          </div>
        </section>

        <section className="mt-6 executive-panel rounded-lg p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <p className="micro-label">Remembered Preferences</p>
            <MessageCircle size={18} className="royal-text" />
          </div>
          {preferences.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Object.entries(groupedPreferences).map(([category, rows]) => (
                <div key={category} className="av-surface rounded-lg p-4">
                  <p className="av-eyebrow av-subtle mb-4">
                    {formatKey(category)}
                  </p>
                  <div className="space-y-3">
                    {rows.map((preference) => (
                      <div key={preference.id}>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm">{formatKey(preference.preference_key)}</p>
                          <span className="av-eyebrow av-subtle">
                            {Math.round(Number(preference.confidence || 0) * 100)}%
                          </span>
                        </div>
                        <p className="av-muted mt-1 text-xs leading-5">
                          {preference.preference_value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No explicit preferences yet"
              body='Tell Aeonvera things like "do not schedule workouts in the morning" or "I need direct accountability."'
            />
          )}
        </section>

        <section className="mt-6 executive-panel rounded-lg p-6">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="micro-label">Long-Term Memory</p>
              <p className="av-muted mt-2 text-sm leading-6">
                Raw submitted memories and distilled agent memories that can be retrieved by semantic similarity.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <button
                type="button"
                onClick={exportSemanticMemories}
                className="av-eyebrow premium-action-secondary inline-flex h-10 items-center justify-center rounded-md px-4"
              >
                Export
              </button>
              <button
                type="button"
                onClick={() => void forgetAllSemanticMemories()}
                disabled={!semanticMemories.length}
                className="av-eyebrow premium-action-secondary inline-flex h-10 items-center justify-center rounded-md px-4 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Forget all
              </button>
              <Clock size={18} className="royal-text" />
            </div>
          </div>
          {semanticMemories.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {semanticMemories.map((item) => (
                <article key={item.id} className="av-surface rounded-lg p-4">
                  <div className="mb-3 flex items-start justify-between gap-4">
                    <div>
                      <p className="av-eyebrow av-subtle">
                        {formatKey(item.memory_kind || item.source_type)}
                      </p>
                      <h2 className="mt-2 text-sm font-medium leading-5">
                        {item.title || "Remembered signal"}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => void forgetSemanticMemory(item.id)}
                      className="av-icon-danger size-8"
                      aria-label="Forget this memory"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <p className="av-muted line-clamp-3 text-xs leading-5">{item.content}</p>
                  <div className="av-eyebrow av-subtle mt-4 flex items-center justify-between gap-3">
                    <span>{Math.round(Number(item.importance || 0) * 100)}% important</span>
                    <span>{formatFreshness(item.occurred_at || item.created_at)}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No long-term memories yet"
              body="Ask Aeonvera questions, speak to the orb, and give protocol feedback. New memories will appear here after the semantic memory migration is active."
            />
          )}
        </section>
      </div>
    </PageContainer>
  );
}

function MemoryMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="executive-panel flex min-h-[10rem] flex-col rounded-lg p-5">
      <p className="micro-label">{label}</p>
      <div className="mt-auto pt-5">
        <p className="tabular-nums text-2xl font-light leading-none text-white">{value}</p>
        <p className="av-muted mt-3 min-h-10 text-xs leading-5">{detail}</p>
      </div>
    </div>
  );
}

function MemoryStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="av-surface rounded-lg p-4">
      <p className="av-eyebrow av-subtle">{label}</p>
      <p className="mt-2 text-sm">{value}</p>
      <p className="av-muted mt-1 text-xs leading-5">{detail}</p>
    </div>
  );
}

function groupPreferences(preferences: AgentPreference[]) {
  return preferences.reduce<Record<string, AgentPreference[]>>((acc, preference) => {
    const category = preference.category || "general";
    acc[category] = [...(acc[category] || []), preference];
    return acc;
  }, {});
}

function buildMemoryNextAction({
  confidence,
  preferencesCount,
  semanticMemoryCount,
}: {
  confidence: number;
  preferencesCount: number;
  semanticMemoryCount: number;
}) {
  if (semanticMemoryCount === 0) {
    return {
      actionLabel: "Tell Aeonvera",
      body: "Start with one sentence about how you want to be coached, what gets in your way, or what you are trying to protect.",
      href: "/companion",
      title: "Give Aeonvera one durable clue",
    };
  }

  if (preferencesCount === 0) {
    return {
      actionLabel: "Teach a preference",
      body: "A direct preference makes the assistant easier immediately: timing, tone, reminders, foods, workouts, or boundaries.",
      href: "/companion",
      title: "Turn memory into a preference",
    };
  }

  if (confidence < 60) {
    return {
      actionLabel: "Chat for context",
      body: "Aeonvera has fragments. A short companion session helps connect them into a more reliable coaching model.",
      href: "/companion",
      title: "Strengthen the personal model",
    };
  }

  return {
    actionLabel: "Use Companion",
    body: "Your memory layer is active. The easiest next step is to ask Aeonvera what it would change in today’s plan.",
    href: "/companion",
    title: "Put the memory to work",
  };
}

function styleLabel(value?: string) {
  if (!value) return "Building";
  return formatKey(value);
}

function formatKey(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatFreshness(value?: string | null) {
  if (!value) return "Building";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Building";
  const days = Math.round((Date.now() - date.getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}
