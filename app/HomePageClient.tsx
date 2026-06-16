"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
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
    body: "Biological age, assessment, dashboard, and first report.",
  },
  {
    id: "elite",
    name: "Elite",
    price: "$199",
    body: "Advanced biomarker analysis, alerts, and deeper reporting.",
  },
  {
    id: "sovereign",
    name: "Sovereign",
    price: "$999",
    body: "Unlimited analysis, exports, and concierge-level support.",
  },
] satisfies Array<{ id: Plan; name: string; price: string; body: string }>;

const CAPABILITIES = [
  "Biological age",
  "Labs and biomarkers",
  "Wearables",
  "Daily protocol",
  "Care network",
  "Physician reports",
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
          <h1>Aeonvera.</h1>
          <p className="aeon-apple-hero-subtitle">
            Private longevity intelligence for the body you are becoming.
          </p>
          <div className="aeon-apple-cta-row">
            <Link
              href={authenticated ? "/dashboard" : "/login?mode=signup"}
              className="apple-cta-primary"
            >
              {authenticated ? "Open Today" : "Start assessment"}
            </Link>
            <Link href="/pricing" className="apple-cta-link">
              View plans <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      <section className="aeon-apple-section aeon-apple-section-light">
        <div className="aeon-apple-copy">
          <h2>One private model. Every signal.</h2>
          <p>
            Labs, wearables, recovery, behavior, and clinical context become a single
            health state that can explain what matters next.
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
          <h2>Your digital twin gets more precise every day.</h2>
          <p>
            Aeonvera learns from your latest measurements, detects drift, and turns the
            next action into something your day can actually hold.
          </p>
          <Link href="/digital-twin" className="apple-cta-link">
            Explore Twin <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      <section className="aeon-apple-section aeon-apple-section-dark">
        <div className="aeon-orb-showcase" aria-hidden="true">
          <div className="aeon-orb-showcase-field" />
          <div className="aeon-orb-showcase-core" />
        </div>
        <div className="aeon-apple-copy aeon-apple-copy-center">
          <h2>Ask. Plan. Move.</h2>
          <p>
            The assistant is not decoration. It answers from your Aeonvera context,
            opens the right surface, prepares reports, and helps execute your plan.
          </p>
          <Link href="/companion" className="apple-cta-link apple-cta-link-light">
            Open companion <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      <section className="aeon-apple-pricing">
        <div className="aeon-apple-copy aeon-apple-copy-center">
          <h2>Choose how much Aeonvera runs for you.</h2>
          <p>Start with biological age. Scale into deeper analysis, execution, and care-team reporting.</p>
        </div>

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
              <span className="aeon-apple-plan-body">{plan.body}</span>
              <span className="aeon-apple-plan-check">
                <Check size={15} /> Monthly membership
              </span>
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
