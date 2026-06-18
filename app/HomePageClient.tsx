"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import AeonOrbVisual from "@/components/layout/AeonOrbVisual";
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
    body: "Essential longevity OS for focused operators.",
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
    body: "Advanced intelligence for performance-driven longevity.",
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
    body: "The complete longevity infrastructure for those who lead.",
    features: [
      "Everything in Elite",
      "Full digital twin",
      "Physician-ready exports",
      "Concierge integration",
    ],
  },
] satisfies Array<{ id: Plan; name: string; price: string; body: string; features: string[] }>;

const CAPABILITIES = [
  "Biological age modeling",
  "Wearable intelligence",
  "Biomarker analysis",
  "Future-self simulation",
  "Proactive reminders",
  "Physician-ready exports",
];

export default function HomePage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const activePlan =
    profile?.plan && isSubscriptionValid(profile.subscription_status)
      ? profile.plan
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
      window.location.assign(data.url);
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
      window.location.assign(data.url);
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
              The operating system for your biological future.
            </p>
            <div className="aeon-apple-cta-row">
              <Link
                href={authenticated ? "/dashboard" : "/login?mode=signup"}
                className="apple-cta-primary"
              >
                Open Today
              </Link>
              <Link href="/pricing" className="apple-cta-link">
                View plans <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="aeon-apple-section aeon-apple-section-light">
        <div className="aeon-apple-copy">
          <h2>A continuously updating digital human.</h2>
          <p>
            Aeonvera ingests labs, wearables, recovery, behavior, and clinical context
            into one private model that updates as your life changes.
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
            alt="A futuristic age reversal portrait moving from older to younger"
            fill
            sizes="(max-width: 900px) 100vw, 50vw"
            className="object-cover"
          />
        </div>
        <div className="aeon-apple-split-copy">
          <h2>Simulate the body you could become.</h2>
          <p>
            Ask what happens if you lose weight, raise VO2 max, improve sleep, or change
            nutrition. Aeonvera turns possible futures into practical next actions.
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
          <h2>Your longevity coach should reach you first.</h2>
          <p>
            When sleep drops, recovery weakens, fasting windows shift, or a protocol
            starts slipping, Aeonvera should notice and guide the next healthy move.
          </p>
          <Link href="/companion" className="apple-cta-link apple-cta-link-light">
            Open companion <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {activePlan ? (
        <section className="aeon-apple-member">
          <div className="aeon-member-system">
            <span className="aeon-member-kicker">{activePlan} is active</span>
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
            <h2>Choose how much of your biological future Aeonvera runs.</h2>
            <p>Start with biological age. Scale into digital twin modeling, proactive coaching, and concierge-level health intelligence.</p>
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
                <span className="aeon-apple-plan-emblem" aria-hidden="true">
                  <span />
                </span>
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
