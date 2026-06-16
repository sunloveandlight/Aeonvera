"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { type PricingPlan } from "@/components/pricing/PricingPlanCard";
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
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan }),
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

  function getPlanActionLabel(plan: Plan) {
    const planName = PLAN_BY_ID[plan]?.name || plan;
    if (!activePlan) return `Choose ${planName}`;
    if (plan === activePlan) return "Manage";
    if (PLAN_RANK[plan] < PLAN_RANK[activePlan]) return "Downgrade";
    return "Upgrade";
  }

  return (
    <div className="aeon-apple-page text-white">
      <section className="aeon-apple-pricing">
        <div className="aeon-apple-copy aeon-apple-copy-center">
          {activePlan && ownedCopy && activePlanDetails ? (
            <>
              <h2>Your {activePlanDetails.name} plan is active.</h2>
              <p>
                Your tier stays active until you choose otherwise. Manage billing
                or move into any other plan.
              </p>
            </>
          ) : (
            <>
              <h2>Choose the right level of longevity insight.</h2>
              <p>
                Start with a reliable baseline. Move into deeper support as your
                data, goals, and decision-making grow.
              </p>
            </>
          )}
        </div>

        {checkoutMessage && (
          <div className="mx-auto mt-6 max-w-xl rounded-lg border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm leading-6 text-red-200/80">
            {checkoutMessage}
          </div>
        )}

        <div className="aeon-apple-plan-grid">
          {PLANS.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => handleCheckout(plan.id)}
              disabled={loadingPlan !== null}
              className={`aeon-apple-plan ${plan.id === "elite" ? "aeon-apple-plan-featured" : ""}`}
            >
              <span className="aeon-apple-plan-name">{plan.name}</span>
              {activePlan && plan.id === activePlan ? (
                <span className="aeon-apple-plan-price">Active</span>
              ) : (
                <span className="aeon-apple-plan-price">{plan.price}</span>
              )}
              <span className="aeon-apple-plan-body">{plan.summary}</span>
              {plan.features.slice(0, 4).map((feature) => (
                <span key={feature} className="aeon-apple-plan-check">
                  <Check size={15} /> {feature}
                </span>
              ))}
              <span className="aeon-apple-plan-action">
                {loadingPlan === plan.id ? "Opening" : getPlanActionLabel(plan.id)}
                {loadingPlan !== plan.id ? <ArrowRight size={15} /> : null}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
