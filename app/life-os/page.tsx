"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Brain,
  BriefcaseBusiness,
  CircleDollarSign,
  HeartPulse,
  Network,
  Sparkles,
  Target,
  Zap,
  type LucideIcon,
} from "lucide-react";
import PageContainer from "@/components/ui/PageContainer";
import AccessState from "@/components/ui/AccessState";
import { supabase } from "@/lib/supabase/client";

type LifeDomain = {
  confidence: number;
  currentState: string;
  desiredState: string;
  direction: "improving" | "stable" | "declining" | "learning";
  domain: string;
  evidence: Record<string, number>;
  keyRisk: string;
  label: string;
  nextAction: string;
  score: number;
};

type LifeOsPayload = {
  domains: LifeDomain[];
  migrationRequired?: boolean;
  nextBestMove?: {
    detail: string;
    domain: string;
    reason: string;
  } | null;
  summary: string;
  trajectory: {
    confidence: number;
    status: "forming" | "organized" | "compounding";
    strongestDomain: string;
    weakestDomain: string;
  };
  upgrade?: {
    minimumPlan?: string;
    message?: string;
  };
};

const DOMAIN_ICONS: Record<string, LucideIcon> = {
  cognition: Brain,
  emotional_resilience: HeartPulse,
  financial_health: CircleDollarSign,
  health: HeartPulse,
  learning: Brain,
  performance: Zap,
  productivity: BriefcaseBusiness,
  purpose: Target,
  relationships: Network,
  sleep: Sparkles,
  stress: HeartPulse,
};

export default function LifeOsPage() {
  const [payload, setPayload] = useState<LifeOsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLifeOs() {
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
        const response = await fetch("/api/life-os/trajectory", {
          credentials: "include",
        });
        const data = await response.json();

        if (response.status === 403) {
          if (!cancelled) {
            setPayload(data);
            setLocked(true);
          }
          return;
        }

        if (!response.ok) {
          throw new Error(data.error || "Could not load Life OS.");
        }

        if (!cancelled) {
          setPayload(data);
          if (data.migrationRequired) {
            setMessage(
              "Apply supabase/migrations/20260613140000_life_os_domain_profiles.sql to enable saved Life OS domain profiles."
            );
          }
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Could not load Life OS.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadLifeOs();

    return () => {
      cancelled = true;
    };
  }, []);

  const domains = useMemo(() => payload?.domains || [], [payload?.domains]);
  const topDomains = useMemo(
    () => [...domains].sort((a, b) => b.score - a.score).slice(0, 3),
    [domains]
  );

  return (
    <PageContainer>
      <main className="py-14">
        {loading ? (
          <AccessState
            eyebrow="Life OS"
            title="Loading your trajectory."
            body="Aeonvera is assembling health, capability, behavior, and support signals into a whole-life operating model."
            actions={[{ href: "/digital-twin", label: "Digital Twin", variant: "secondary" }]}
          />
        ) : signedOut ? (
          <AccessState
            eyebrow="Life OS"
            title="Sign in to access your trajectory."
            body="Life OS contains sensitive personal intelligence across health, cognition, work, resilience, and future direction."
            actions={[
              { href: "/login?mode=signin", label: "Sign in" },
              { href: "/pricing", label: "Compare tiers", variant: "secondary" },
            ]}
          />
        ) : locked ? (
          <AccessState
            eyebrow="Sovereign Life OS"
            title="Unlock whole-life intelligence."
            body={
              payload?.upgrade?.message ||
              "Life OS is the Sovereign layer that expands Aeonvera from health optimization into full life trajectory intelligence."
            }
            actions={[
              { href: "/pricing", label: "Unlock Sovereign" },
              { href: "/plan", label: "Your Plan", variant: "secondary" },
            ]}
          />
        ) : (
          <div className="space-y-6">
            <section className="executive-panel rounded-lg p-6 md:p-8">
              <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
                <div>
                  <p className="micro-label">Phase 11 / Human Optimization Platform</p>
                  <h1 className="mt-4 text-4xl font-light leading-tight text-white md:text-6xl">
                    Your future self becomes operational.
                  </h1>
                  <p className="mt-5 max-w-3xl text-sm leading-7 text-white/52">
                    {payload?.summary ||
                      "Aeonvera is extending beyond health into capability, cognition, productivity, relationships, purpose, and long-term freedom."}
                  </p>
                  {message ? (
                    <p className="mt-4 text-sm leading-6 text-[#dabc73]/76">{message}</p>
                  ) : null}
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-black/20 p-5">
                  <p className="micro-label">Trajectory Status</p>
                  <p className="mt-4 text-4xl font-light capitalize text-white">
                    {payload?.trajectory.status || "forming"}
                  </p>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <Signal label="Strongest" value={payload?.trajectory.strongestDomain || "--"} />
                    <Signal label="Constraint" value={payload?.trajectory.weakestDomain || "--"} />
                  </div>
                </div>
              </div>
            </section>

            {payload?.nextBestMove ? (
              <section className="executive-panel rounded-lg p-6 md:p-7">
                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="micro-label">Next Best Move</p>
                    <h2 className="mt-3 text-3xl font-light text-white">
                      Stabilize {payload.nextBestMove.domain}.
                    </h2>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-white/50">
                      {payload.nextBestMove.detail}
                    </p>
                    <p className="mt-3 text-xs leading-6 text-[#dabc73]/72">
                      Why Aeonvera recommends this: {payload.nextBestMove.reason}
                    </p>
                  </div>
                  <Link
                    href="/companion"
                    className="premium-action inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium"
                  >
                    Ask Aeonvera
                    <ArrowRight size={15} />
                  </Link>
                </div>
              </section>
            ) : null}

            <section className="grid gap-4 md:grid-cols-3">
              {topDomains.map((domain) => (
                <div key={domain.domain} className="executive-panel rounded-lg p-5">
                  <p className="micro-label">{domain.label}</p>
                  <p className="mt-4 text-4xl font-light text-white">{domain.score}</p>
                  <p className="mt-3 text-sm capitalize text-white/42">{domain.direction}</p>
                </div>
              ))}
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              {domains.map((domain) => (
                <DomainCard key={domain.domain} domain={domain} />
              ))}
            </section>
          </div>
        )}
      </main>
    </PageContainer>
  );
}

function DomainCard({ domain }: { domain: LifeDomain }) {
  const Icon = DOMAIN_ICONS[domain.domain] || Sparkles;

  return (
    <article className="executive-panel rounded-lg p-5 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="micro-label">{domain.direction}</p>
          <h2 className="mt-3 text-2xl font-light text-white">{domain.label}</h2>
        </div>
        <Icon className="royal-text" size={22} />
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-[#dabc73]"
          style={{ width: `${Math.max(4, Math.min(100, domain.score))}%` }}
        />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <CopyBlock title="Current state" body={domain.currentState} />
        <CopyBlock title="Desired state" body={domain.desiredState} />
        <CopyBlock title="Key risk" body={domain.keyRisk} />
        <CopyBlock title="Next action" body={domain.nextAction} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {Object.entries(domain.evidence)
          .filter(([, value]) => value > 0)
          .slice(0, 5)
          .map(([key, value]) => (
            <span
              key={`${domain.domain}-${key}`}
              className="rounded-md border border-white/[0.07] bg-black/20 px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-white/36"
            >
              {key.replace(/([A-Z])/g, " $1")} {value}
            </span>
          ))}
      </div>
    </article>
  );
}

function CopyBlock({ body, title }: { body: string; title: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.14em] text-white/28">{title}</p>
      <p className="mt-2 text-xs leading-6 text-white/46">{body}</p>
    </div>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/[0.06] bg-white/[0.025] px-3 py-3">
      <p className="text-[9px] uppercase tracking-[0.14em] text-white/28">{label}</p>
      <p className="mt-2 text-sm text-white/70">{value}</p>
    </div>
  );
}
