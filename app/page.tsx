"use client";

import { type CSSProperties, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Dna, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { isSubscriptionValid, type SubscriptionStatus } from "@/lib/auth/permissions";

const METRICS = [
  ["47+", "inputs"],
  ["8", "domains"],
  ["90", "day plan"],
  ["24/7", "monitoring"],
];

const DOMAINS = [
  "Cardiovascular",
  "Metabolic",
  "Sleep",
  "Exercise",
  "Nutrition",
  "Cognitive",
  "Body composition",
  "Genetics",
];

const CAPABILITIES = [
  {
    title: "Biological age model",
    body: "A structured assessment turns biometrics, lifestyle data, and optional labs into a clear biological age estimate.",
  },
  {
    title: "Clinical-domain scoring",
    body: "Eight health domains are evaluated independently so you can see what is driving the result.",
  },
  {
    title: "Decision-ready report",
    body: "Your report prioritizes the highest-leverage changes and converts them into a practical 90-day plan.",
  },
];

const STEPS = [
  ["Assess", "Complete a guided profile across core healthspan inputs."],
  ["Understand", "Review biological age, risk context, and confidence."],
  ["Improve", "Follow a focused plan and update the model as data changes."],
];

type Plan = "core" | "elite" | "sovereign";

type Profile = {
  plan: Plan | null;
  subscription_status: SubscriptionStatus | null;
};

type RestingHeartRate = {
  bpm: number;
  personalized: boolean;
};

type HealthStateRow = {
  baseline?: Record<string, number> | null;
};

type HealthMetricRow = {
  value?: number | string | null;
};

const PLAN_RANK: Record<Plan, number> = {
  core: 1,
  elite: 2,
  sovereign: 3,
};

const DEFAULT_MALE_RESTING_HEART_RATE = 72;

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

function normalizeHeartRate(value: unknown) {
  const bpm = Number(value);
  return Number.isFinite(bpm) && bpm >= 35 && bpm <= 130 ? Math.round(bpm) : null;
}

function HeroVisual({ restingHeartRate }: { restingHeartRate: RestingHeartRate }) {
  const biometricDuration = `${Math.max(4.6, Math.min(8.4, (60 / restingHeartRate.bpm) * 6.3))}s`;

  return (
    <Link
      href="/optimization"
      aria-label="Open optimization"
      className="hero-stage group relative flex h-full cursor-pointer overflow-hidden rounded-xl border border-white/10 p-6 transition hover:border-white/[0.18] md:p-7"
    >
      <div className="relative z-10 flex h-full w-full flex-col">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white">Healthspan overview</p>
            <p className="mt-1 text-sm text-white/50">Updated from your latest assessment</p>
          </div>
          <span className="premium-action inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition group-hover:opacity-95">
            Optimize
            <ArrowRight size={14} />
          </span>
        </div>

        <div className="grid gap-5 lg:grid-cols-[0.88fr_1.12fr] lg:items-stretch">
          <div
            className="hero-age-block"
            style={{ "--biometric-duration": biometricDuration } as CSSProperties}
          >
            <div className="age-signal" aria-hidden="true">
              <div className="age-signal__halo" />
              <svg viewBox="20 20 120 120">
                <defs>
                  <linearGradient id="age-signal-gradient" x1="36" y1="28" x2="124" y2="132" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="rgba(248,250,252,0.94)" />
                    <stop offset="48%" stopColor="rgba(164, 195, 255, 0.82)" />
                    <stop offset="74%" stopColor="rgba(218, 188, 115, 0.78)" />
                    <stop offset="100%" stopColor="rgba(248,250,252,0.9)" />
                  </linearGradient>
                </defs>
                <circle className="age-signal__track" cx="80" cy="80" r="58" />
                <circle className="age-signal__progress" cx="80" cy="80" r="58" />
                <circle className="age-signal__inner" cx="80" cy="80" r="34" />
                <path className="age-signal__wave" pathLength={100} d="M34 83 H55 L63 72 L74 94 L86 65 L98 83 H126" />
                <line className="age-signal__hand" x1="80" y1="80" x2="80" y2="34" />
                <path className="age-signal__scan" d="M80 28 A52 52 0 0 1 132 80" />
                <circle className="age-signal__dot" cx="122" cy="48" r="3.2" />
              </svg>
            </div>

            <div className="hero-age-copy">
              <p className="hero-age-label font-medium uppercase tracking-[0.14em] text-white/42">Biological age</p>
              <div className="hero-age-value flex items-end gap-2">
                <p className="hero-age-number hero-metric-glow font-light leading-none">38.4</p>
                <p className="hero-age-unit leading-none text-white/42">years</p>
              </div>
              <p className="hero-age-note font-medium text-white/50">
                2.6 years below chronological baseline.
              </p>
            </div>
          </div>

          <div className="hero-domain-panel">
            {[
              ["Cardiovascular", "86%"],
              ["Metabolic", "78%"],
              ["Recovery", "72%"],
              ["Movement", "91%"],
              ["VO2 Max", "82%"],
            ].map(([label, width]) => (
              <div key={label} className="hero-domain-row">
                <div className="hero-domain-labels mb-2 flex items-center justify-between gap-4">
                  <span>{label}</span>
                  <span>{width}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="hero-pulse living-bar h-full origin-left rounded-full"
                    style={{ width }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto grid gap-3 pt-5 sm:grid-cols-3">
          {[
            ["Risk score", "24", "low"],
            ["Accuracy", "84%", "high"],
            ["Priority", "Sleep", "next"],
          ].map(([label, value, note]) => (
            <div key={label} className="rounded-lg border border-white/[0.06] bg-white/[0.035] p-4">
              <p className="text-sm text-white/40">{label}</p>
              <p className="mt-2 text-2xl font-light text-white">{value}</p>
              <p className="mt-1 text-sm text-white/40">{note}</p>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [restingHeartRate, setRestingHeartRate] = useState<RestingHeartRate>({
    bpm: DEFAULT_MALE_RESTING_HEART_RATE,
    personalized: false,
  });
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
        setRestingHeartRate({
          bpm: DEFAULT_MALE_RESTING_HEART_RATE,
          personalized: false,
        });
        return;
      }

      const [profileRes, assessmentRes, healthStateRes, heartMetricRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("plan, subscription_status")
          .eq("user_id", data.user.id)
          .maybeSingle(),
        supabase
          .from("longevity_assessments")
          .select("resting_hr")
          .eq("user_id", data.user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("health_states")
          .select("baseline")
          .eq("user_id", data.user.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("health_metrics")
          .select("value")
          .eq("user_id", data.user.id)
          .eq("metric", "resting_hr")
          .order("measured_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (!cancelled && profileRes.data) {
        setProfile({
          plan: profileRes.data.plan as Plan | null,
          subscription_status: profileRes.data.subscription_status as SubscriptionStatus | null,
        });
      }

      if (!cancelled) {
        const healthState = healthStateRes.data as HealthStateRow | null;
        const latestHeartMetric = heartMetricRes.data as HealthMetricRow | null;
        const latestBpm = normalizeHeartRate(latestHeartMetric?.value);
        const wearableBpm = normalizeHeartRate(healthState?.baseline?.resting_hr);
        const assessmentBpm = normalizeHeartRate(assessmentRes.data?.resting_hr);
        const bpm = latestBpm ?? wearableBpm ?? assessmentBpm;

        setRestingHeartRate({
          bpm: bpm ?? DEFAULT_MALE_RESTING_HEART_RATE,
          personalized: bpm !== null,
        });
      }
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      setAuthenticated(!!session?.user);
      loadUser();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  function getPlanActionLabel(plan: Plan) {
    if (!activePlan) return `Choose ${PLANS.find((item) => item.id === plan)?.name || plan}`;
    if (plan === activePlan) return "Manage current plan";
    if (PLAN_RANK[plan] < PLAN_RANK[activePlan]) return "Included";
    return `Upgrade to ${PLANS.find((item) => item.id === plan)?.name || plan}`;
  }

  async function handleBillingPortal(plan: Plan) {
    try {
      setLoadingPlan(plan);
      const res = await fetch("/api/stripe/customer-portal", {
        method: "POST",
        credentials: "include",
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
    <div className="text-white">
      <section className="px-6 pt-24 pb-24 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-2 lg:items-stretch">
          <div className="flex flex-col justify-between">
            <div className="premium-status mb-8 inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm">
              <ShieldCheck size={16} className="royal-text" />
              Private longevity intelligence
            </div>

            <h1 className="max-w-4xl text-5xl font-light leading-[1.04] text-white md:text-6xl xl:text-7xl">
              Know your biological age. Improve it with precision.
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-white/60 md:text-xl">
              Aeonvera gives you a decision-ready view of your healthspan:
              biological age, domain signals, risk context, and a practical plan.
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link
                href={authenticated ? "/dashboard" : "/login?mode=signup"}
                className="premium-action inline-flex h-12 w-full items-center justify-center gap-2 rounded-md px-6 text-sm font-medium transition hover:opacity-95 sm:w-auto"
              >
                {authenticated ? "Open dashboard" : "Start assessment"}
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/pricing"
                className="premium-action-secondary inline-flex h-12 w-full items-center justify-center rounded-md px-6 text-sm font-medium transition sm:w-auto"
              >
                View plans
              </Link>
            </div>
          </div>

          <HeroVisual restingHeartRate={restingHeartRate} />
        </div>
      </section>

      <section className="px-6 pb-24 lg:px-8">
        <div className="premium-surface mx-auto max-w-6xl rounded-lg p-6 md:p-8">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <div
                className="living-dashboard-pulse mb-6 flex size-12 items-center justify-center rounded-lg"
              >
                <svg className="dashboard-heartbeat-monitor" viewBox="0 0 64 40" aria-hidden="true">
                  <defs>
                    <filter id="dashboard-heartbeat-light-glow" x="-80%" y="-80%" width="260%" height="260%">
                      <feGaussianBlur stdDeviation="2.6" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <path
                    id="dashboard-heartbeat-path"
                    className="dashboard-heartbeat-monitor__line"
                    pathLength={100}
                    d="M4 22 H20 L25 13 L32 30 L39 9 L45 22 H60"
                  />
                  <path
                    className="dashboard-heartbeat-monitor__trace dashboard-heartbeat-monitor__trace--halo"
                    pathLength={100}
                    filter="url(#dashboard-heartbeat-light-glow)"
                    style={{ "--heartbeat-duration": `${Math.max(1.8, Math.min(3.2, 120 / restingHeartRate.bpm))}s` } as CSSProperties}
                    d="M4 22 H20 L25 13 L32 30 L39 9 L45 22 H60"
                  />
                  <path
                    className="dashboard-heartbeat-monitor__trace dashboard-heartbeat-monitor__trace--core"
                    pathLength={100}
                    style={{ "--heartbeat-duration": `${Math.max(1.8, Math.min(3.2, 120 / restingHeartRate.bpm))}s` } as CSSProperties}
                    d="M4 22 H20 L25 13 L32 30 L39 9 L45 22 H60"
                  />
                </svg>
              </div>
              <h2 className="max-w-xl text-3xl font-light leading-tight md:text-5xl">
                A healthspan dashboard that stays out of your way.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-white/55">
                No decorative complexity. No noisy wellness feed. Just the
                numbers that matter, the domains behind them, and what to do next.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {METRICS.map(([value, label]) => (
                <div key={label} className="rounded-lg bg-white/[0.055] p-5 transition duration-300 hover:bg-white/[0.08]">
                  <p className="text-4xl font-light leading-none text-white">{value}</p>
                  <p className="mt-3 text-sm text-white/50">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[rgba(36,50,74,0.1)] px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <p className="text-eyebrow">Coverage</p>
              <h2 className="mt-4 text-3xl font-light leading-tight md:text-5xl">
                One model across eight clinical domains.
              </h2>
            </div>
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {DOMAINS.map((domain) => (
                <div key={domain} className="border-b border-white/[0.08] pb-4 text-base text-white/64">
                  {domain}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[rgba(36,50,74,0.1)] px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 max-w-3xl">
            <p className="text-eyebrow">Platform</p>
            <h2 className="mt-4 text-3xl font-light leading-tight md:text-5xl">
              Professional health intelligence, reduced to essentials.
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {CAPABILITIES.map((item) => (
              <div key={item.title} className="premium-surface rounded-lg p-7">
                <Dna size={24} className="mb-8 text-[rgb(var(--royal))]" />
                <h3 className="text-xl font-light text-white">{item.title}</h3>
                <p className="mt-4 text-sm leading-7 text-white/55">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[rgba(36,50,74,0.1)] px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <p className="text-eyebrow">Workflow</p>
              <h2 className="mt-4 text-3xl font-light leading-tight md:text-5xl">
                Built for repeatable progress.
              </h2>
            </div>
            <div className="space-y-6">
              {STEPS.map(([title, body], index) => (
                <div key={title} className="grid gap-4 border-b border-white/[0.08] pb-6 sm:grid-cols-[72px_1fr]">
                  <p className="text-sm text-white/35">{String(index + 1).padStart(2, "0")}</p>
                  <div>
                    <h3 className="text-xl font-light text-white">{title}</h3>
                    <p className="mt-2 text-sm leading-7 text-white/55">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[rgba(36,50,74,0.1)] px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="text-eyebrow">Membership</p>
              <h2 className="mt-4 text-3xl font-light leading-tight md:text-5xl">
                Choose your level of support.
              </h2>
            </div>
            <Link href="/pricing" className="inline-flex items-center gap-2 text-sm font-medium royal-text">
              Full pricing <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => handleCheckout(plan.id)}
                disabled={loadingPlan !== null}
                className={`pricing-plan-card premium-surface cursor-pointer rounded-lg p-7 text-left disabled:cursor-not-allowed disabled:opacity-60 ${
                  plan.id === "elite"
                    ? "pricing-plan-card-featured"
                    : plan.id === "sovereign"
                    ? "pricing-plan-card-sovereign"
                    : ""
                }`}
              >
                <h3 className="text-xl font-light">{plan.name}</h3>
                {activePlan && PLAN_RANK[plan.id] <= PLAN_RANK[activePlan] ? (
                  <div className="mt-6">
                    <p className="text-[10px] uppercase tracking-[0.14em] royal-text">
                      {plan.id === activePlan ? "Current membership" : "Already unlocked"}
                    </p>
                    <p className="mt-2 text-2xl font-light text-white/82">
                      {plan.id === activePlan ? "Active tier" : "Included"}
                    </p>
                  </div>
                ) : (
                  <p className="mt-6 text-4xl font-light">{plan.price}</p>
                )}
                <p className="mt-4 text-sm leading-7 text-white/55">{plan.body}</p>
                <div className="mt-8 flex items-center gap-2 text-sm text-white/60">
                  <Check size={16} />
                  Monthly membership
                </div>
                <div className="premium-action mt-7 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md px-5 text-sm font-medium">
                  {loadingPlan === plan.id ? "Opening" : getPlanActionLabel(plan.id)}
                  {loadingPlan !== plan.id && <ArrowRight size={16} />}
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[rgba(36,50,74,0.1)] px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-4xl font-light leading-tight md:text-6xl">
            Start with the number that changes the conversation.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-white/55">
            Your biological age is the baseline. Aeonvera helps you make it useful.
          </p>
          <Link
            href={authenticated ? "/assessment" : "/login?mode=signup"}
            className="premium-action mt-9 inline-flex h-12 items-center justify-center gap-2 rounded-md px-6 text-sm font-medium transition hover:opacity-95"
          >
            {authenticated ? "Update assessment" : "Get started"}
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}
