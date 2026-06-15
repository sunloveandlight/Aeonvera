"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Crown, LockKeyhole, Settings } from "lucide-react";
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
      <main className="py-14">
        {loading ? (
          <AccessState
            eyebrow="Your Plan"
            title="Loading your private access layer."
            body="Aeonvera is checking your membership, usage, and unlocked intelligence."
            actions={[{ href: "/pricing", label: "View tiers", variant: "secondary" }]}
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
                  <h1 className="mt-4 text-4xl font-light leading-tight text-white md:text-5xl">
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
                  <p className="mt-4 text-3xl font-light text-white">
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

            <section className="grid gap-4 lg:grid-cols-2">
              <FeatureGroup items={included} title="Unlocked now" tone="included" />
              <FeatureGroup items={locked} title="Protected until upgrade" tone="locked" />
            </section>
          </div>
        )}
      </main>
    </PageContainer>
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
                    className="mt-2 inline-flex items-center gap-2 text-[9px] uppercase tracking-[0.14em] text-[rgba(var(--gold),0.75)] transition hover:text-[rgb(var(--gold))]"
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
