"use client";

import { type CSSProperties, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  Database,
  Dna,
  Smartphone,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { isSubscriptionValid, type SubscriptionStatus } from "@/lib/auth/permissions";

const METRICS = [
  ["47+", "health signals"],
  ["8", "clinical domains"],
  ["90", "day protocol"],
  ["24/7", "coach memory"],
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
    title: "Measure the body",
    body: "Biological age, recovery, sleep, activity, biomarkers, and risk signals are organized into one private health state.",
  },
  {
    title: "Understand the leverage",
    body: "Aeonvera separates noise from signal, explains what is driving the result, and shows why each recommendation matters.",
  },
  {
    title: "Act without friction",
    body: "Protocols become reminders, calendar blocks, mobile notifications, and adaptive coaching that fits your real life.",
  },
];

const STEPS = [
  ["Signal", "Wearables, labs, assessments, calendars, and feedback rebuild your live health state."],
  ["Intelligence", "Aeonvera reasons across the domains and selects the highest-leverage next move."],
  ["Execution", "The app turns the plan into reminders, calendar blocks, notifications, and follow-up memory."],
];

const ECOSYSTEM = [
  {
    icon: Database,
    title: "Labs + biomarkers",
    body: "ApoB, glucose, hs-CRP, hormones, thyroid, vitamin D, and more.",
  },
  {
    icon: Dna,
    title: "Wearables + recovery",
    body: "Oura, Apple Health imports, HRV, sleep, resting heart rate, and VO2 max.",
  },
  {
    icon: Smartphone,
    title: "Mobile companion",
    body: "Voice, notifications, reminders, action feedback, and native calendar execution.",
  },
  {
    icon: CalendarCheck,
    title: "Autopilot execution",
    body: "Daily plans move from insight into the actual structure of your day.",
  },
];

const INTELLIGENCE_LOOP = [
  ["Reads", "Sleep, recovery, labs, assessment, adherence, and preferences."],
  ["Decides", "Ranks the next action by leverage, confidence, timing, and friction."],
  ["Acts", "Schedules, reminds, explains, adapts, and remembers what works."],
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
      className="hero-stage hero-product-stage group relative flex h-full w-full cursor-pointer overflow-hidden rounded-xl border border-white/10 p-6 transition hover:border-white/[0.18] md:p-8"
    >
      <div className="hero-product-aura" aria-hidden="true" />
      <div className="hero-product-lens" aria-hidden="true" />

      <div className="relative z-10 grid h-full w-full gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="hero-product-copy">
          <p className="text-sm font-medium text-white/72">Health intelligence</p>
          <h2 className="mt-4 max-w-md text-3xl font-semibold leading-tight text-white md:text-5xl">
            A private model of what your body is asking for next.
          </h2>
          <p className="mt-5 max-w-md text-sm leading-7 text-white/52">
            Aeonvera turns fragmented labs, recovery, sleep, and behavior into one calm signal.
          </p>
          <span className="mt-7 inline-flex items-center gap-2 text-sm font-medium royal-text">
            Open optimization
            <ArrowRight size={15} />
          </span>
        </div>

        <div className="hero-product-device">
          <div className="hero-product-device-glass">
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
                    <stop offset="74%" stopColor="rgba(var(--gold),0.78)" />
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
              <p className="hero-age-label font-medium uppercase tracking-[0.14em] text-white/42">Example biological age</p>
              <div className="hero-age-value flex items-end gap-2">
                <p className="hero-age-number hero-metric-glow font-light leading-none">38.4</p>
                <p className="hero-age-unit leading-none text-white/42">years</p>
              </div>
              <p className="hero-age-note font-medium text-white/50">
                Demo profile: 2.6 years below chronological baseline.
              </p>
            </div>
          </div>

            <div className="hero-domain-panel">
              {[
                ["Cardiovascular", "86%"],
                ["Metabolic", "78%"],
                ["Recovery", "72%"],
                ["Movement", "91%"],
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
    if (PLAN_RANK[plan] < PLAN_RANK[activePlan]) return `Downgrade to ${PLANS.find((item) => item.id === plan)?.name || plan}`;
    return `Upgrade to ${PLANS.find((item) => item.id === plan)?.name || plan}`;
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
    <div className="text-white">
      <section className="aeon-home-hero px-6 pt-24 pb-20 lg:px-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center text-center">
          <div className="mx-auto max-w-4xl">
            <h1 className="text-6xl font-semibold leading-[0.98] text-white md:text-7xl xl:text-8xl">
              Aeonvera.
            </h1>

            <p className="mx-auto mt-7 max-w-2xl text-2xl font-semibold leading-tight text-white/78 md:text-3xl">
              Private intelligence for your body.
            </p>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/56">
              Labs, wearables, biological age, recovery, and behavior become one calm operating system that explains, plans, reminds, schedules, and adapts.
            </p>

            <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href={authenticated ? "/dashboard" : "/login?mode=signup"}
                className="premium-action inline-flex h-12 w-full items-center justify-center gap-2 rounded-md px-6 text-sm font-medium transition hover:opacity-95 sm:w-auto"
              >
                {authenticated ? "Open Today" : "Start assessment"}
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

          <div className="aeon-home-hero-visual mx-auto mt-14 w-full max-w-6xl">
            <HeroVisual restingHeartRate={restingHeartRate} />
          </div>
        </div>
      </section>

      <section className="apple-section-band px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h2 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight md:text-5xl">
                Every signal becomes part of the same intelligence layer.
              </h2>
            </div>
            <p className="max-w-md text-sm leading-7 text-white/50">
              Wearables measure continuously. Aeonvera connects the measurement
              layer to reasoning, coaching, protocol execution, and memory.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {ECOSYSTEM.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="apple-feature-tile rounded-lg p-6">
                  <Icon size={20} className="royal-text" />
                  <h3 className="mt-8 text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/52">{item.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-6 py-24 lg:px-8">
        <div className="apple-showcase-panel mx-auto max-w-6xl rounded-lg p-6 md:p-10">
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
              <h2 className="max-w-xl text-3xl font-semibold leading-tight md:text-5xl">
                A healthspan dashboard that stays out of your way.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-white/55">
                No noisy wellness feed. Aeonvera keeps the decisive signals in
                view, then moves the next action into your phone, calendar, and day.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {METRICS.map(([value, label]) => (
                <div key={label} className="rounded-lg bg-white/[0.055] p-5 transition duration-300 hover:bg-white/[0.08]">
                  <p className="text-4xl font-semibold leading-none text-white">{value}</p>
                  <p className="mt-3 text-sm text-white/50">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/[0.06] px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <p className="text-eyebrow">Coverage</p>
              <h2 className="mt-4 text-3xl font-semibold leading-tight md:text-5xl">
                One model across the domains that shape healthspan.
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

      <section className="border-t border-white/[0.06] px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 max-w-3xl">
            <p className="text-eyebrow">Platform</p>
            <h2 className="mt-4 text-3xl font-semibold leading-tight md:text-5xl">
              From signal to protocol to execution.
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {CAPABILITIES.map((item) => (
              <div key={item.title} className="premium-surface rounded-lg p-7">
                <Dna size={24} className="mb-8 text-[rgb(var(--royal))]" />
                <h3 className="text-xl font-semibold text-white">{item.title}</h3>
                <p className="mt-4 text-sm leading-7 text-white/55">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/[0.06] px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
            <div>
              <p className="text-eyebrow">Intelligence Loop</p>
              <h2 className="mt-4 text-3xl font-semibold leading-tight md:text-5xl">
                The system gets sharper as your life produces signal.
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {INTELLIGENCE_LOOP.map(([title, body]) => (
                <div key={title} className="rounded-lg border border-white/[0.08] bg-white/[0.035] p-5">
                  <p className="text-sm font-medium royal-text">{title}</p>
                  <p className="mt-3 text-sm leading-6 text-white/52">{body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <p className="text-eyebrow">Workflow</p>
              <h2 className="mt-4 text-3xl font-semibold leading-tight md:text-5xl">
                Built for progress you can actually live.
              </h2>
            </div>
            <div className="space-y-6">
              {STEPS.map(([title, body], index) => (
                <div key={title} className="grid gap-4 border-b border-white/[0.08] pb-6 sm:grid-cols-[72px_1fr]">
                  <p className="text-sm text-white/35">{String(index + 1).padStart(2, "0")}</p>
                  <div>
                    <h3 className="text-xl font-semibold text-white">{title}</h3>
                    <p className="mt-2 text-sm leading-7 text-white/55">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/[0.06] px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="text-eyebrow">Membership</p>
              <h2 className="mt-4 text-3xl font-semibold leading-tight md:text-5xl">
                Choose how much Aeonvera runs for you.
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
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                {activePlan && plan.id === activePlan ? (
                  <div className="mt-6">
                    <p className="text-[10px] uppercase tracking-[0.14em] royal-text">
                      Current membership
                    </p>
                    <p className="mt-2 text-2xl font-light text-white/82">
                      Active tier
                    </p>
                  </div>
                ) : (
                  <p className="mt-6 text-4xl font-semibold">{plan.price}</p>
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

      <section className="border-t border-white/[0.06] px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-4xl font-semibold leading-tight md:text-6xl">
            Start with the number. Build the operating system.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-white/55">
            Biological age is the baseline. Aeonvera turns it into a living
            plan for recovery, performance, prevention, and long-term healthspan.
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
