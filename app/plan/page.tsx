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

type ConciergeRequest = {
  fulfillmentStage?: string;
  id: string;
  paymentStatus?: string;
  status: string;
};

type ReferralApplication = {
  id: string;
  partnerType: PartnerType;
  referralCode: string;
  status: string;
};

type PartnerType = "physician" | "coach" | "health_creator" | "other";

const PLAN_ORDER = ["core", "elite", "sovereign"];

export default function PlanPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [usageLimits, setUsageLimits] = useState<UsageLimitsPayload | null>(null);
  const [conciergeRequest, setConciergeRequest] = useState<ConciergeRequest | null>(null);
  const [referralApplication, setReferralApplication] = useState<ReferralApplication | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [openingBilling, setOpeningBilling] = useState(false);
  const [requestingConcierge, setRequestingConcierge] = useState(false);
  const [submittingReferral, setSubmittingReferral] = useState(false);
  const [partnerType, setPartnerType] = useState<PartnerType>("health_creator");

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
        const [usageResponse, conciergeResponse, referralResponse] = await Promise.all([
          fetch("/api/usage/limits", { credentials: "include" }),
          fetch("/api/concierge/onboarding", { credentials: "include" }),
          fetch("/api/referrals/partner", { credentials: "include" }),
        ]);
        const data = await usageResponse.json();

        if (!usageResponse.ok) {
          throw new Error(data.error || "Could not load your plan.");
        }

        const conciergeData = await conciergeResponse.json().catch(() => null);
        const referralData = await referralResponse.json().catch(() => null);

        if (!cancelled) {
          setAuthenticated(true);
          setUsageLimits(data);
          if (conciergeResponse.ok) {
            setConciergeRequest(conciergeData?.request || null);
          }
          if (referralResponse.ok) {
            setReferralApplication(referralData?.application || null);
          }
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

  useEffect(() => {
    const conciergeResult = new URLSearchParams(window.location.search).get("concierge");
    if (conciergeResult === "cancelled") {
      window.setTimeout(() => {
        setMessage("Concierge checkout was cancelled. Your request is saved, and you can restart payment when ready.");
      }, 0);
    }
  }, []);

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

  async function requestConcierge() {
    setRequestingConcierge(true);
    setMessage(null);

    try {
      const response = await fetch("/api/concierge/onboarding", {
        body: JSON.stringify({
          requestedScope: [
            "lab_intake",
            "wearable_setup",
            "clinician_export",
            "first_30_day_protocol",
          ],
        }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not request concierge onboarding.");
      }

      setConciergeRequest(data.request || null);
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }

      setMessage("Concierge request submitted. We will follow up with the onboarding path.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not request concierge onboarding.");
    } finally {
      setRequestingConcierge(false);
    }
  }

  async function applyForReferralCredits() {
    setSubmittingReferral(true);
    setMessage(null);

    try {
      const response = await fetch("/api/referrals/partner", {
        body: JSON.stringify({ partnerType }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not submit referral application.");
      }

      setReferralApplication(data.application || null);
      setMessage("Referral application submitted. Your provisional code is ready for review.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not submit referral application.");
    } finally {
      setSubmittingReferral(false);
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

            <SovereignRevenuePanel
              conciergeRequest={conciergeRequest}
              currentPlan={usageLimits?.plan || null}
              partnerType={partnerType}
              referralApplication={referralApplication}
              requestingConcierge={requestingConcierge}
              submittingReferral={submittingReferral}
              onPartnerTypeChange={setPartnerType}
              onReferralApply={() => void applyForReferralCredits()}
              onRequestConcierge={() => void requestConcierge()}
            />

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

function SovereignRevenuePanel({
  conciergeRequest,
  currentPlan,
  onPartnerTypeChange,
  onReferralApply,
  onRequestConcierge,
  partnerType,
  referralApplication,
  requestingConcierge,
  submittingReferral,
}: {
  conciergeRequest: ConciergeRequest | null;
  currentPlan: string | null;
  onPartnerTypeChange: (value: PartnerType) => void;
  onReferralApply: () => void;
  onRequestConcierge: () => void;
  partnerType: PartnerType;
  referralApplication: ReferralApplication | null;
  requestingConcierge: boolean;
  submittingReferral: boolean;
}) {
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
            $5,000
          </span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          {["Lab intake", "Wearable setup", "Clinician export", "30-day protocol"].map((item) => (
            <div key={item} className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-3">
              <p className="text-xs leading-5 text-white/58">{item}</p>
            </div>
          ))}
        </div>
        {conciergeRequest ? (
          <p className="mt-5 rounded-md border border-[rgba(var(--gold),0.18)] bg-[rgba(var(--gold),0.06)] px-3 py-2 text-sm text-[rgba(var(--gold),0.82)]">
            Concierge request: {statusLabel(conciergeRequest.status)}
            {conciergeRequest.paymentStatus ? ` / ${statusLabel(conciergeRequest.paymentStatus)}` : ""}
            {conciergeRequest.fulfillmentStage ? ` / ${statusLabel(conciergeRequest.fulfillmentStage)}` : ""}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onRequestConcierge}
            disabled={requestingConcierge}
            className="premium-action inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Crown size={15} />
            {requestingConcierge ? "Requesting" : "Request concierge"}
          </button>
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
        {referralApplication ? (
          <div className="mt-5 rounded-md border border-white/[0.08] bg-white/[0.03] p-3">
            <p className="text-sm text-white/72">
              Application: {statusLabel(referralApplication.status)}
            </p>
            <p className="av-eyebrow mt-2 text-[rgba(var(--gold),0.72)]">
              Code {referralApplication.referralCode}
            </p>
          </div>
        ) : (
          <label className="mt-5 block">
            <span className="av-eyebrow av-subtle mb-2 block">
              Partner type
            </span>
            <select
              value={partnerType}
              onChange={(event) => onPartnerTypeChange(event.target.value as PartnerType)}
              className="av-field h-11 w-full rounded-md px-3 text-sm"
            >
              <option value="health_creator">Health creator</option>
              <option value="physician">Physician</option>
              <option value="coach">Coach</option>
              <option value="other">Other</option>
            </select>
          </label>
        )}
        <button
          type="button"
          onClick={onReferralApply}
          disabled={submittingReferral}
          className="premium-action-secondary mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Gift size={15} />
          {submittingReferral
            ? "Submitting"
            : referralApplication
            ? "Submit another channel"
            : "Apply for credits"}
        </button>
      </div>
    </section>
  );
}

function statusLabel(status: string) {
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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
