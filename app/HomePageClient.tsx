"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
    body: "Biological age, unified health timeline, and first longevity report.",
  },
  {
    id: "elite",
    name: "Elite",
    price: "$199",
    body: "Proactive coaching, future-self simulation, and advanced biomarker analysis.",
  },
  {
    id: "sovereign",
    name: "Sovereign",
    price: "$999",
    body: "Full digital twin, unlimited reports, physician exports, and concierge integration.",
  },
] satisfies Array<{ id: Plan; name: string; price: string; body: string }>;

const CAPABILITIES = [
  "Biological age modeling",
  "Wearable intelligence",
  "Biomarker analysis",
  "Future-self simulation",
  "Proactive reminders",
  "Physician-ready exports",
];

export default function HomePage() {
  const showcaseOrbRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    let animationFrame = 0;
    const seed = Math.random() * 1000;

    function animateShowcaseOrb(time: number) {
      const orb = showcaseOrbRef.current;
      if (orb) {
        const t = time / 1000 + seed;
        const aX = Math.sin(t * 0.73) * 5.4 + Math.sin(t * 1.91 + 1.7) * 2.2;
        const aY = Math.cos(t * 0.61 + 0.4) * 5.1 + Math.sin(t * 1.37) * 2;
        const bX = Math.cos(t * 0.47 + 2.1) * 6.6 + Math.sin(t * 1.13) * 1.8;
        const bY = Math.sin(t * 0.83 + 0.8) * 5.8 + Math.cos(t * 1.67) * 2.4;
        const cX = Math.sin(t * 0.39 + 3.4) * 7.2 + Math.cos(t * 1.29) * 1.7;
        const cY = Math.cos(t * 0.52 + 2.8) * 6.5 + Math.sin(t * 1.49) * 1.9;
        const dX = Math.sin(t * 0.31 + 5.2) * 4.8 + Math.cos(t * 1.73) * 2.6;
        const dY = Math.cos(t * 0.69 + 4.6) * 4.8 + Math.sin(t * 1.07) * 2.5;

        orb.style.setProperty("--orb-live-a-x", `${aX.toFixed(2)}%`);
        orb.style.setProperty("--orb-live-a-y", `${aY.toFixed(2)}%`);
        orb.style.setProperty("--orb-live-b-x", `${bX.toFixed(2)}%`);
        orb.style.setProperty("--orb-live-b-y", `${bY.toFixed(2)}%`);
        orb.style.setProperty("--orb-live-c-x", `${cX.toFixed(2)}%`);
        orb.style.setProperty("--orb-live-c-y", `${cY.toFixed(2)}%`);
        orb.style.setProperty("--orb-live-d-x", `${dX.toFixed(2)}%`);
        orb.style.setProperty("--orb-live-d-y", `${dY.toFixed(2)}%`);
        orb.style.setProperty("--orb-hue", `${(Math.sin(t * 0.19) * 9).toFixed(2)}deg`);
      }

      animationFrame = window.requestAnimationFrame(animateShowcaseOrb);
    }

    animationFrame = window.requestAnimationFrame(animateShowcaseOrb);
    return () => window.cancelAnimationFrame(animationFrame);
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
            The operating system for your biological future.
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
        <div className="aeon-orb-showcase" aria-hidden="true">
          <div ref={showcaseOrbRef} className="aeon-command-orb aeon-orb-showcase-orb">
            <span className="aeon-command-orb-core">
              <span className="aeon-orb-bloom" />
            </span>
            <span className="aeon-orb-sheen" aria-hidden="true" />
          </div>
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
