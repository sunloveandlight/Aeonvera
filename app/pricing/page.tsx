"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, Crown, Settings, ShieldCheck, Sparkles } from "lucide-react";
import PageContainer from "@/components/ui/PageContainer";
import Page from "@/components/ui/Page";
import Section from "@/components/ui/Section";
import SectionTitle from "@/components/ui/SectionTitle";
import Text from "@/components/ui/Text";
import Motion from "@/components/motion/Motion";
import PricingPlanCard, { type PricingPlan } from "@/components/pricing/PricingPlanCard";
import { supabase } from "@/lib/supabase/client";
import {
  PLAN_USAGE_LIMITS,
  isSubscriptionValid,
  type SubscriptionStatus,
} from "@/lib/auth/permissions";
import { getUserSubscription } from "@/lib/auth/getUserSubscription";

type Plan = "core" | "elite" | "sovereign";

type Profile = {
  plan: Plan | null;
  subscription_status: SubscriptionStatus | null;
};

const PLAN_RANK: Record<Plan, number> = {
  core: 1,
  elite: 2,
  sovereign: 3,
};

const PLANS: PricingPlan[] = [
  {
    id: "core",
    name: "Core",
    price: "$49",
    summary: "For establishing a clear longevity baseline.",
    features: [
      "Biological age computation",
      "Full healthspan assessment",
      "AI longevity report",
      `${PLAN_USAGE_LIMITS.core.agent_question.monthly} AI health questions/month`,
      "Risk profile analysis",
      "Core lab upload and clinical flagging",
    ],
    depth: "Baseline intelligence",
    details: [
      {
        label: "Function Set",
        items: [
          "One active biological age baseline",
          "Assessment-driven recommendations",
          "Manual Apple Health import",
          `${PLAN_USAGE_LIMITS.core.lab_import.monthly} lab imports/month`,
          `${PLAN_USAGE_LIMITS.core.report_generation.monthly} report generations/month`,
          "Foundational protocols: sleep, protein, walking, Zone 2, strength, alcohol reduction",
        ],
      },
      {
        label: "Best For",
        items: [
          "Users starting their first healthspan baseline",
          "Monthly check-ins and simple risk context",
        ],
      },
    ],
  },
  {
    id: "elite",
    name: "Elite",
    price: "$199",
    summary: "For ongoing optimization with deeper analysis.",
    features: [
      "Everything in Core",
      "Advanced biomarker analysis",
      "Proactive AI coaching",
      `${PLAN_USAGE_LIMITS.elite.agent_question.monthly.toLocaleString()} AI health questions/month`,
      `${PLAN_USAGE_LIMITS.elite.voice_question.monthly} voice conversations/month`,
      "Daily intelligence alerts",
      "Personalized intervention sequencing",
      "Red light, cold exposure, and PEMF decision support",
    ],
    depth: "Continuous optimization",
    details: [
      {
        label: "Function Set",
        items: [
          "Daily proactive coach contact",
          "Wearable-sync health state updates",
          "Trend-aware sleep, recovery, and activity alerts",
          `${PLAN_USAGE_LIMITS.elite.report_generation.monthly} higher-depth report regenerations/month`,
          `${PLAN_USAGE_LIMITS.elite.future_self_simulation.monthly} future-self simulations/month`,
          "Elite modality protocols with contraindication screening",
        ],
      },
      {
        label: "Automation",
        items: [
          "Email delivery via coach pipeline",
          "Push registration ready for mobile devices",
          "Behavior memory influences recommendations",
          "Autopilot daily plan preparation and calendar execution",
        ],
      },
    ],
    recommended: true,
  },
  {
    id: "sovereign",
    name: "Sovereign",
    price: "$999",
    summary: "For private executive-level health intelligence.",
    features: [
      "Everything in Elite",
      `${PLAN_USAGE_LIMITS.sovereign.agent_question.monthly.toLocaleString()} AI health questions/month`,
      `${PLAN_USAGE_LIMITS.sovereign.voice_question.monthly.toLocaleString()} voice conversations/month`,
      "Digital twin modeling",
      "Physician-ready exports",
      "Concierge data integration",
      "HBOT and epigenetic/telomere experiment strategy",
      "Family account readiness",
      "Executive-level scenario modeling",
    ],
    depth: "Executive digital twin",
    details: [
      {
        label: "Function Set",
        items: [
          "Full digital twin timeline",
          `${PLAN_USAGE_LIMITS.sovereign.report_generation.monthly} report generations/month`,
          `${PLAN_USAGE_LIMITS.sovereign.lab_import.monthly} concierge lab imports/month`,
          "Physician-ready reporting and exports",
          "Multi-source data ingestion strategy",
          "Advanced scenario simulation readiness",
          "Clinician-reviewed advanced modality planning",
        ],
      },
      {
        label: "Operating Model",
        items: [
          "Concierge-level data integration",
          "Family/account expansion path",
          "Most complete intervention and longitudinal tracking tier",
          "Sovereign-only regenerative protocol strategy and longitudinal experiment review",
        ],
      },
    ],
  },
];

const PLAN_BY_ID = PLANS.reduce(
  (plans, plan) => ({ ...plans, [plan.id]: plan }),
  {} as Record<Plan, PricingPlan>
);

const OWNED_TIER_COPY: Record<Plan, {
  title: string;
  body: string;
  owned: string[];
  upgradeIntro: string;
}> = {
  core: {
    title: "Core membership",
    body: "Your biological age baseline, assessment history, dashboard, and first intelligence report are active.",
    owned: [
      "Biological age computation",
      "Healthspan assessment and baseline",
      "AI longevity report",
      "Core lab upload and clinical flagging",
    ],
    upgradeIntro: "Move from a baseline experience into continuous optimization.",
  },
  elite: {
    title: "Elite membership",
    body: "Your optimization layer is active with proactive coaching, wearable-aware state, and deeper report regeneration.",
    owned: [
      "Everything in Core",
      "Proactive AI coaching",
      "Daily intelligence alerts",
      "Wearable-sync health state updates",
      "Elite advanced modality decision support",
    ],
    upgradeIntro: "Move from optimization into the full executive digital twin path.",
  },
  sovereign: {
    title: "Sovereign membership",
    body: "You are already on the highest Aeonvera tier with the complete private intelligence path unlocked.",
    owned: [
      "Everything in Elite",
      "10,000 AI health questions/month",
      "Digital twin modeling",
      "Physician-ready exports",
      "Concierge data integration",
      "HBOT and epigenetic/telomere strategy",
    ],
    upgradeIntro: "Your account is already at the highest tier.",
  },
};

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authenticated, setAuthenticated] = useState(false);

  const activePlan =
    profile?.plan && isSubscriptionValid(profile.subscription_status)
      ? profile.plan
      : null;

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      const subscriptionState = await getUserSubscription();
      const user = subscriptionState.user;

      if (cancelled) return;
      setAuthenticated(Boolean(user));

      if (!user) return;

      if (!cancelled) {
        setProfile({
          plan: subscriptionState.plan as Plan | null,
          subscription_status: subscriptionState.subscriptionStatus,
        });
      }
    }

    loadProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadProfile();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function handleBillingPortal(plan: Plan) {
    try {
      setLoadingPlan(plan);
      setCheckoutMessage(null);

      const res = await fetch("/api/stripe/customer-portal", {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Could not open billing management.");
      }

      window.location.assign(data.url);
    } catch (err) {
      console.error(err);
      setCheckoutMessage(
        err instanceof Error
          ? err.message
          : "Failed to open billing management."
      );
    } finally {
      setLoadingPlan(null);
    }
  }

  async function handleCheckout(plan: Plan) {
    if (activePlan) {
      await handleBillingPortal(plan);
      return;
    }

    if (!authenticated) {
      window.location.assign("/login?mode=signup");
      return;
    }

    try {
      setLoadingPlan(plan);
      setCheckoutMessage(null);

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Checkout failed");
      }

      window.location.assign(data.url);
    } catch (err) {
      console.error(err);
      setCheckoutMessage(
        err instanceof Error
          ? err.message
          : "Failed to start checkout. Please try again."
      );
    } finally {
      setLoadingPlan(null);
    }
  }

  const activePlanDetails = activePlan ? PLAN_BY_ID[activePlan] : null;
  const ownedCopy = activePlan ? OWNED_TIER_COPY[activePlan] : null;
  const upgradePlans = activePlan
    ? PLANS.filter((plan) => PLAN_RANK[plan.id] > PLAN_RANK[activePlan])
    : [];

  return (
    <Page className="text-white" density="compact">
      <Section className="px-6 lg:px-8" intensity="low">
        <PageContainer>
          {activePlan && ownedCopy && activePlanDetails ? (
            <div className="mx-auto max-w-4xl text-center">
              <p className="text-eyebrow">Membership</p>
              <h1 className="mt-5 text-4xl font-light leading-tight text-white md:text-6xl">
                Your {activePlanDetails.name} plan is active.
              </h1>
              <Text
                variant="secondary"
                className="mx-auto mt-6 block max-w-2xl text-center text-lg leading-8"
              >
                Pricing is hidden because you already have access. From here,
                you can manage billing or move into any higher tier.
              </Text>
            </div>
          ) : (
            <>
              <SectionTitle
                eyebrow="Pricing"
                title="Choose the right level of longevity intelligence."
                align="center"
              />
              <Text
                variant="secondary"
                className="mx-auto mt-6 block max-w-2xl text-center text-lg leading-8"
              >
              Start with a reliable baseline. Move into deeper support as your
              data, goals, and decision-making needs grow.
              </Text>
            </>
          )}
          {checkoutMessage && (
            <div className="mx-auto mt-6 max-w-xl rounded-lg border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm leading-6 text-red-200/80">
              {checkoutMessage}
            </div>
          )}
        </PageContainer>
      </Section>

      <Section className="px-6 pb-24 lg:px-8" intensity="low">
        <PageContainer>
          {activePlan && ownedCopy && activePlanDetails ? (
            <div
              className={`mx-auto grid max-w-6xl gap-5 ${
                upgradePlans.length > 1 ? "lg:grid-cols-3" : "lg:grid-cols-[1.1fr_0.9fr]"
              }`}
            >
              <button
                type="button"
                onClick={() => handleBillingPortal(activePlan)}
                disabled={loadingPlan !== null}
                className="membership-current-card quiet-lift flex flex-col items-start rounded-lg p-7 text-left disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="membership-card-top w-full">
                  <div className="membership-card-emblem flex size-12 items-center justify-center rounded-lg bg-white/[0.06] text-white/82">
                    <ShieldCheck size={22} />
                  </div>
                  <p className="micro-label">Current plan</p>
                  <h2 className="membership-card-title text-3xl font-light text-white md:text-4xl">
                    {ownedCopy.title}
                  </h2>
                  <p className="mt-5 max-w-2xl text-sm leading-7 text-white/55">
                    {ownedCopy.body}
                  </p>
                </div>
                <div className="premium-status membership-active-badge rounded-md px-3 py-1.5 text-xs font-medium">
                  Active
                </div>

                <div className="mt-9 grid w-full gap-3 sm:grid-cols-2">
                  {ownedCopy.owned.map((item) => (
                    <div key={item} className="flex gap-3 rounded-lg border border-white/[0.07] bg-white/[0.025] p-4 text-sm leading-6 text-white/68">
                      <Check size={16} className="mt-1 shrink-0 royal-text" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-9 flex w-full items-center justify-between gap-4 border-t border-white/[0.07] pt-5">
                  <span className="text-sm text-white/42">
                    Opens billing, invoices, payment method, and cancellation settings.
                  </span>
                  <span className="premium-action-secondary inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium">
                    {loadingPlan === activePlan ? "Opening" : "Manage"}
                    {loadingPlan !== activePlan && <Settings size={16} />}
                  </span>
                </div>
              </button>

              {upgradePlans.length > 0 ? (
                upgradePlans.map((upgradePlan) => (
                  <button
                    key={upgradePlan.id}
                    type="button"
                    onClick={() => handleBillingPortal(upgradePlan.id)}
                    disabled={loadingPlan !== null}
                    className="membership-upgrade-card quiet-lift flex flex-col items-start rounded-lg p-7 text-left disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className="membership-card-top w-full">
                      <div className="membership-card-emblem flex size-12 items-center justify-center rounded-lg bg-white/[0.06] text-white/86">
                        {upgradePlan.id === "sovereign" ? <Crown size={22} /> : <Sparkles size={22} />}
                      </div>
                      <p className="micro-label">
                        {upgradePlan.id === "sovereign" ? "Executive upgrade" : "Optimization upgrade"}
                      </p>
                      <h2 className="membership-card-title text-3xl font-light text-white md:text-4xl">
                        {upgradePlan.name}
                      </h2>
                    </div>
                    <p className="mt-5 text-sm leading-7 text-white/55">
                      {upgradePlan.id === "sovereign"
                        ? "Move directly into the full executive digital-twin path."
                        : ownedCopy.upgradeIntro}
                    </p>

                    <div className="mt-8 space-y-3">
                      {upgradePlan.features.slice(1, 5).map((feature) => (
                        <div key={feature} className="flex gap-3 text-sm leading-6 text-white/68">
                          <Check size={16} className="mt-1 shrink-0 royal-text" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>

                    <div className="premium-action mt-9 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md text-sm font-medium">
                      {loadingPlan === upgradePlan.id ? "Opening" : `Upgrade to ${upgradePlan.name}`}
                      {loadingPlan !== upgradePlan.id && <ArrowRight size={16} />}
                    </div>
                    <p className="mt-4 text-center text-xs leading-5 text-white/35">
                      Billing details and proration are confirmed securely before any change.
                    </p>
                  </button>
                ))
              ) : (
                <div className="membership-upgrade-card rounded-lg p-7">
                  <div className="mb-7 flex size-12 items-center justify-center rounded-lg bg-white/[0.06] text-white/86">
                    <Crown size={22} />
                  </div>
                  <p className="micro-label">Highest tier</p>
                  <h2 className="mt-4 text-3xl font-light text-white md:text-4xl">
                    Everything is unlocked.
                  </h2>
                  <p className="mt-5 text-sm leading-7 text-white/55">
                    Sovereign is the top tier. There is no upsell above this,
                    only account management and deeper product experiences.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleBillingPortal(activePlan)}
                    disabled={loadingPlan !== null}
                    className="premium-action mt-9 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loadingPlan === activePlan ? "Opening" : "Manage membership"}
                    {loadingPlan !== activePlan && <Settings size={16} />}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-3">
              {PLANS.map((plan) => (
                <Motion key={plan.id} type="rise" className="h-full">
                  <PricingPlanCard
                    plan={plan}
                    loadingPlan={loadingPlan}
                    mode="purchase"
                    onSelect={handleCheckout}
                  />
                </Motion>
              ))}
            </div>
          )}
        </PageContainer>
      </Section>
    </Page>
  );
}
