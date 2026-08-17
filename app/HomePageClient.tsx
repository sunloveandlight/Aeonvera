"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import AeonOrbVisual from "@/components/layout/AeonOrbVisual";
import { PricingPlanEmblem } from "@/components/pricing/PricingPlanEmblem";
import { supabase } from "@/lib/supabase/client";
import { isSubscriptionValid, type SubscriptionStatus } from "@/lib/auth/permissions";

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

const PLANS = [
  {
    id: "core",
    name: "Core",
    price: "$49",
    body: "Baseline health intelligence for people starting with labs, wearables, and biological age.",
    features: [
      "Biological age tracking",
      "Unified health timeline",
      "AI longevity report",
      "Core lab intelligence",
    ],
  },
  {
    id: "elite",
    name: "Elite",
    price: "$199",
    body: "Proactive coaching for people actively changing sleep, training, nutrition, and protocols.",
    features: [
      "Everything in Core",
      "Proactive coaching",
      "Future-self simulation",
      "Advanced biomarkers",
    ],
  },
  {
    id: "sovereign",
    name: "Sovereign",
    price: "$999",
    body: "Full digital-twin context, clinical sharing, and concierge-level longevity infrastructure.",
    features: [
      "Everything in Elite",
      "Full digital twin",
      "Physician-ready exports",
      "Concierge integration",
    ],
  },
] satisfies Array<{ id: Plan; name: string; price: string; body: string; features: string[] }>;

const CAPABILITIES = [
  "Import labs and wearables",
  "Track biological age",
  "Explain biomarker changes",
  "Prioritize next actions",
  "Model future scenarios",
  "Prepare clinician summaries",
];

export default function HomePage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const activePlan =
    profile?.plan && isSubscriptionValid(profile.subscription_status)
      ? profile.plan
      : null;
  const activePlanDetails = activePlan
    ? PLANS.find((plan) => plan.id === activePlan)
    : null;

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;

      setAuthenticated(!!data.user);

      if (!data.user) {
        setProfile(null);
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("plan, subscription_status")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (!cancelled && profileData) {
        setProfile({
          plan: profileData.plan as Plan | null,
          subscription_status: profileData.subscription_status as SubscriptionStatus | null,
        });
      }
    }

    void loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      setAuthenticated(!!session?.user);
      void loadUser();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  function getPlanActionLabel(plan: Plan) {
    const planName = PLANS.find((item) => item.id === plan)?.name || plan;
    if (!activePlan) return `Choose ${planName}`;
    if (plan === activePlan) return "Manage";
    if (PLAN_RANK[plan] < PLAN_RANK[activePlan]) return `Downgrade`;
    return `Upgrade`;
  }

  async function handleBillingPortal(plan: Plan) {
    try {
      setLoadingPlan(plan);
      const res = await fetch("/api/stripe/customer-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Could not open billing management.");
      await leaveForStripe(data.url);
    } catch (err) {
      console.error(err);
      window.location.assign("/pricing");
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
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Checkout failed");
      await leaveForStripe(data.url);
    } catch (err) {
      console.error(err);
      window.location.assign("/pricing");
    } finally {
      setLoadingPlan(null);
    }
  }

  function activateVoiceOrb() {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("aeonvera:activate-voice-orb"));
  }

  return (
    <div className="aeon-apple-page text-white">
      <section className="aeon-apple-hero">
        <div className="aeon-apple-hero-media" aria-hidden="true">
          <Image
            src="/marketing/rejuvenation-woman.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </div>
        <div className="aeon-apple-hero-shade" aria-hidden="true" />
        <div className="aeon-apple-hero-content">
          <div className="aeon-apple-hero-brand">
            <h1>AEONVERA</h1>
          </div>
          <div className="aeon-apple-hero-copy">
            <p className="aeon-apple-hero-subtitle">
              Private AI longevity intelligence for labs, wearables, protocols,
              and clinician-ready next steps.
            </p>
            <div className="aeon-apple-cta-row">
              <Link
                href={authenticated ? "/dashboard" : "/demo"}
                className="apple-cta-primary"
              >
                {authenticated ? "Open Today" : "View demo"}
              </Link>
              <Link
                href={authenticated ? "/dashboard" : "/login?mode=signup"}
                className="apple-cta-link"
              >
                {authenticated ? "Dashboard" : "Create account"} <ArrowRight size={15} />
              </Link>
              <Link href="/pricing" className="apple-cta-link">
                View plans <ArrowRight size={15} />
              </Link>
            </div>
            <p className="aeon-apple-hero-note">
              Preview sample health data before entering your own.
            </p>
          </div>
        </div>
      </section>

      <section className="aeon-apple-section aeon-apple-section-light">
        <div className="aeon-apple-copy">
          <h2>Know what your health data is telling you.</h2>
          <p>
            Aeonvera brings labs, wearables, recovery, behavior, and clinical
            context into one private model, then shows what changed, what matters,
            and what deserves your next conversation or action.
          </p>
        </div>
        <div className="aeon-signal-strip" aria-label="Aeonvera capabilities">
          {CAPABILITIES.map((capability) => (
            <span key={capability}>{capability}</span>
          ))}
        </div>
      </section>

      <section className="aeon-apple-split">
        <div className="aeon-apple-split-media">
          <Image
            src="/marketing/rejuvenation-man.png"
            alt="A portrait evoking renewal and vitality"
            fill
            sizes="(max-width: 900px) 100vw, 50vw"
            className="object-cover"
          />
        </div>
        <div className="aeon-apple-split-copy">
          <h2>A private model built from your real signals.</h2>
          <p>
            Aeonvera is not a generic chatbot. It works from your timeline,
            biomarkers, habits, goals, and protocols so the guidance is tied to
            your body instead of internet averages.
          </p>
          <Link href="/digital-twin" className="apple-cta-link">
            Explore Twin <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      <section className="aeon-apple-section aeon-apple-section-dark">
        <div className="aeon-orb-showcase">
          <button
            type="button"
            className="aeon-command-orb aeon-orb-showcase-orb"
            onClick={activateVoiceOrb}
            aria-label="Start Aeonvera voice"
          >
            <AeonOrbVisual energy="showcase" />
          </button>
        </div>
        <div className="aeon-apple-copy aeon-apple-copy-center">
          <h2>Ask what changed, what matters, and what to do next.</h2>
          <p>
            The companion can explain lab results, compare trends, help prioritize
            protocols, and turn insight into a tracked plan you can review with a
            qualified clinician.
          </p>
          <Link href="/companion" className="apple-cta-link apple-cta-link-light">
            Open companion <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {activePlan ? (
        <section className="aeon-apple-member">
          <div className="aeon-member-system">
            <span className="aeon-member-kicker">
              {activePlanDetails?.name || activePlan} membership
            </span>
            <h2>Your biological future is already online.</h2>
            <p>
              Continue where Aeonvera is learning: today&apos;s signal, your next protocol,
              and the model that keeps updating as your data changes.
            </p>
            <div className="aeon-member-actions">
              <Link href="/dashboard" className="apple-cta-primary">
                Open Today
              </Link>
              <Link href="/optimization" className="apple-cta-link aeon-member-secondary">
                Continue optimization <ArrowRight size={15} />
              </Link>
              <Link href="/pricing" className="apple-cta-link aeon-member-secondary">
                Manage membership <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <section className="aeon-apple-pricing">
          <div className="aeon-apple-copy aeon-apple-copy-center">
            <h2>Clear plans. No mystery.</h2>
            <p>Core is $49/mo for baseline intelligence. Elite is $199/mo for proactive optimization. Sovereign is $999/mo for digital twin, clinical sharing, and concierge-level context.</p>
            <div className="aeon-pricing-reassurance" aria-label="Aeonvera trust notes">
              <span><Check size={14} /> Demo before signup</span>
              <span><Check size={14} /> Private health profile</span>
              <span><Check size={14} /> Not a medical diagnosis</span>
            </div>
          </div>

          <div className="aeon-apple-plan-grid">
            {PLANS.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => handleCheckout(plan.id)}
                disabled={loadingPlan !== null}
                className={`aeon-apple-plan aeon-apple-plan-${plan.id} ${plan.id === "elite" ? "aeon-apple-plan-featured" : ""}`}
              >
                <PricingPlanEmblem plan={plan.id} />
                <span className="aeon-apple-plan-topline">
                  <span className="aeon-apple-plan-name">{plan.name}</span>
                  {plan.id === "elite" ? (
                    <span className="aeon-apple-plan-badge">
                      <Sparkles size={13} aria-hidden />
                      Most popular
                    </span>
                  ) : null}
                </span>
                <span className="aeon-apple-plan-body">{plan.body}</span>
                <span className="aeon-apple-plan-divider" aria-hidden />
                <span className="aeon-apple-plan-price">
                  {plan.price}
                  <small>/mo</small>
                </span>
                <span className="aeon-apple-plan-depth">Billed monthly</span>
                <span className="aeon-apple-plan-feature-list">
                  {plan.features.map((feature) => (
                    <span key={feature} className="aeon-apple-plan-check">
                      <Check size={15} /> {feature}
                    </span>
                  ))}
                </span>
                <span className="aeon-apple-plan-action">
                  {loadingPlan === plan.id ? "Opening" : getPlanActionLabel(plan.id)}
                  {loadingPlan !== plan.id ? <ArrowRight size={15} /> : null}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

async function leaveForStripe(url: string) {
  window.__aeonveraExternalNavigation = true;
  await supabase.auth.stopAutoRefresh().catch(() => undefined);
  window.location.assign(url);
}
