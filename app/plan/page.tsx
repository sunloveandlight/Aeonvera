"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Crown, Gift, LockKeyhole, Settings } from "lucide-react";
import PageContainer from "@/components/ui/PageContainer";
import AccessState from "@/components/ui/AccessState";
import { supabase } from "@/lib/supabase/client";

type UsageMeterSnapshot = {
  allowed: boolean;
  limit: number;
  meter: string;
  remaining: number;
  used: number;
};

type FeatureEntitlement = {
  allowed: boolean;
  description: string;
  feature: string;
  label: string;
  minimumPlan: string;
  minimumPlanLabel: string;
};

type UsageLimitsPayload = {
  entitlements?: FeatureEntitlement[];
  plan: string | null;
  subscriptionStatus: string | null;
  usage: UsageMeterSnapshot[];
};

const PLAN_ORDER = ["core", "elite", "sovereign"];

export default function PlanPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [usageLimits, setUsageLimits] = useState<UsageLimitsPayload | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [openingBilling, setOpeningBilling] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPlan() {
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

      try {
        const response = await fetch("/api/usage/limits", { credentials: "include" });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Could not load your plan.");
        }

        if (!cancelled) {
          setAuthenticated(true);
          setUsageLimits(data);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Could not load your plan.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPlan();

    return () => {
      cancelled = true;
    };
  }, []);

  const included = useMemo(
    () => (usageLimits?.entitlements || []).filter((item) => item.allowed),
    [usageLimits]
  );
  const locked = useMemo(
    () => (usageLimits?.entitlements || []).filter((item) => !item.allowed),
    [usageLimits]
  );
  const nextPlan = getNextPlan(usageLimits?.plan);

  async function openBilling() {
    setOpeningBilling(true);
    setMessage(null);

    try {
      const response = await fetch("/api/stripe/customer-portal", {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not open billing.");
      }

      window.location.href = data.url;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not open billing.");
    } finally {
      setOpeningBilling(false);
    }
  }

  return (
    <PageContainer>
      <div className="py-14 md:py-16">
        {loading ? (
          <AccessState
            eyebrow="Your Plan"
            title="Loading your private access layer."
            body="Aeonvera is checking your membership, usage, and unlocked intelligence."
            actions={[]}
          />
        ) : authenticated === false ? (
          <AccessState
            eyebrow="Your Plan"
            title="Sign in to see your membership."
            body="Your plan page shows what is unlocked, what is protected, and which intelligence layer Aeonvera recommends next."
            points={[
              "Monthly AI and voice usage",
              "Included and locked capabilities",
              "Billing and upgrade access",
            ]}
            actions={[
              { href: "/login?mode=signin", label: "Sign in" },
              { href: "/pricing", label: "Compare tiers", variant: "secondary" },
            ]}
          />
        ) : (
          <div className="space-y-6">
            <section className="executive-panel rounded-lg p-6 md:p-8">
              <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="micro-label">Your Plan</p>
                  <h1 className="mt-4 leading-tight text-white text-5xl md:text-6xl font-semibold">
                    {usageLimits?.plan ? `${titleCase(usageLimits.plan)} intelligence` : "Membership inactive"}
                  </h1>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-white/52">
                    This is your private access layer: usage, billing, unlocked systems,
                    and the next intelligence tier.
                  </p>
                  {message ? (
                    <p className="mt-4 text-sm leading-6 text-[rgba(var(--gold),0.8)]">{message}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={openBilling}
                    className="premium-action-secondary inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium"
                  >
                    <Settings size={15} />
                    {openingBilling ? "Opening" : "Manage billing"}
                  </button>
                  {nextPlan ? (
                    <Link
                      href="/pricing"
                      className="premium-action inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium"
                    >
                      Unlock {titleCase(nextPlan)}
                      <ArrowRight size={15} />
                    </Link>
                  ) : (
                    <span className="inline-flex h-11 items-center gap-2 rounded-md border border-[rgba(var(--gold),0.25)] bg-[rgba(var(--gold),0.1)] px-5 text-sm text-[rgba(var(--gold),0.85)]">
                      <Crown size={15} />
                      Highest tier
                    </span>
                  )}
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              {(usageLimits?.usage || []).map((item) => (
                <div key={item.meter} className="executive-panel rounded-lg p-5">
                  <p className="micro-label">{usageMeterLabel(item.meter)}</p>
                  <p className="mt-4 text-3xl font-semibold text-white">
                    {item.limit <= 0 ? "Locked" : item.remaining.toLocaleString()}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-white/45">
                    {item.limit <= 0
                      ? "Not included in this tier."
                      : `${item.used.toLocaleString()} used of ${item.limit.toLocaleString()} this month.`}
                  </p>
                </div>
              ))}
            </section>

            <SovereignRevenuePanel currentPlan={usageLimits?.plan || null} />

            <section className="grid gap-4 lg:grid-cols-2">
              <FeatureGroup items={included} title="Unlocked now" tone="included" />
              <FeatureGroup items={locked} title="Protected until upgrade" tone="locked" />
            </section>
          </div>
        )}
      </div>
    </PageContainer>
  );
}

function SovereignRevenuePanel({ currentPlan }: { currentPlan: string | null }) {
  const isSovereign = currentPlan === "sovereign";

  return (
    <section className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
      <div className="executive-panel rounded-lg p-5 md:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="micro-label">Sovereign Concierge</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-white">
              White-glove onboarding for serious health operators.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/50">
              A high-touch setup package for labs, wearables, clinician packet,
              family profile planning, and a first 30-day execution protocol.
            </p>
          </div>
          <span className="premium-status-neutral inline-flex h-10 shrink-0 items-center rounded-md px-3 text-xs text-white/72">
            From $2,500
          </span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          {["Lab intake", "Wearable setup", "Clinician export", "30-day protocol"].map((item) => (
            <div key={item} className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-3">
              <p className="text-xs leading-5 text-white/58">{item}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href="mailto:support@aeonvera.com?subject=Sovereign%20concierge%20onboarding"
            className="premium-action inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium"
          >
            <Crown size={15} />
            Request concierge
          </a>
          {!isSovereign ? (
            <Link
              href="/pricing"
              className="premium-action-secondary inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium"
            >
              Compare Sovereign
              <ArrowRight size={15} />
            </Link>
          ) : null}
        </div>
      </div>

      <div className="executive-panel rounded-lg p-5 md:p-6">
        <p className="micro-label">Referral Credits</p>
        <h2 className="mt-3 text-2xl font-semibold leading-tight text-white">
          Partner with clinicians, coaches, and health creators.
        </h2>
        <p className="mt-4 text-sm leading-7 text-white/50">
          Apply for referral credits when a trusted expert sends members into
          Aeonvera. This keeps the program curated while the automated ledger is
          prepared.
        </p>
        <a
          href="mailto:support@aeonvera.com?subject=Referral%20partner%20application"
          className="premium-action-secondary mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium"
        >
          <Gift size={15} />
          Apply for credits
        </a>
      </div>
    </section>
  );
}

function FeatureGroup({
  items,
  title,
  tone,
}: {
  items: FeatureEntitlement[];
  title: string;
  tone: "included" | "locked";
}) {
  return (
    <div className="executive-panel rounded-lg p-5 md:p-6">
      <p className="micro-label">{title}</p>
      <div className="mt-5 space-y-4">
        {items.length ? (
          items.map((item) => (
            <div key={item.feature} className="flex gap-3">
              <div
                className={`mt-1 inline-flex size-6 shrink-0 items-center justify-center rounded-full border ${
                  tone === "included"
                    ? "border-[rgba(var(--gold),0.3)] bg-[rgba(var(--gold),0.1)] text-[rgb(var(--gold))]"
                    : "border-white/10 bg-white/[0.03] text-white/38"
                }`}
              >
                {tone === "included" ? <Check size={13} /> : <LockKeyhole size={12} />}
              </div>
              <div>
                <p className="text-sm font-light text-white/86">{item.label}</p>
                <p className="mt-1 text-xs leading-5 text-white/42">
                  {tone === "locked" ? `${item.minimumPlanLabel}: ` : ""}
                  {item.description}
                </p>
                {tone === "locked" ? (
                  <Link
                    href="/pricing"
                    className="av-eyebrow mt-2 inline-flex items-center gap-2 text-[rgba(var(--gold),0.75)] transition hover:text-[rgb(var(--gold))]"
                  >
                    Unlock {item.minimumPlanLabel}
                    <ArrowRight size={12} />
                  </Link>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm leading-7 text-white/45">
            {tone === "included"
              ? "Activate a plan to unlock your first intelligence layer."
              : "You are on the complete Aeonvera tier."}
          </p>
        )}
      </div>
    </div>
  );
}

function getNextPlan(plan?: string | null) {
  if (!plan) return "core";
  const index = PLAN_ORDER.indexOf(plan);
  return index >= 0 ? PLAN_ORDER[index + 1] || null : "core";
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ");
}

function usageMeterLabel(meter: string) {
  if (meter === "agent_question") return "AI questions";
  if (meter === "voice_question") return "Voice";
  if (meter === "report_generation") return "Reports";
  if (meter === "future_self_simulation") return "Simulator";
  if (meter === "optimization_protocol") return "Protocols";
  if (meter === "lab_import") return "Lab imports";
  return meter.replaceAll("_", " ");
}
