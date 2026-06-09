"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Brain,
  CircleCheck,
  Dna,
  HeartPulse,
  LineChart,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

const STATS = [
  { value: "47+", label: "health inputs" },
  { value: "8", label: "clinical domains" },
  { value: "90", label: "day protocol" },
  { value: "24/7", label: "trend monitoring" },
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

const FEATURES = [
  {
    icon: Dna,
    title: "Biological Age Engine",
    status: "Available",
    body: "Compute biological age from lifestyle, lab, wearable, and family-history data with accuracy scoring.",
  },
  {
    icon: Brain,
    title: "AI Longevity Report",
    status: "Available",
    body: "Translate your assessment into priorities, risk context, strengths, weaknesses, and a practical protocol.",
  },
  {
    icon: LineChart,
    title: "Trend Intelligence",
    status: "Next",
    body: "Track movement across each domain so the system can identify drift before it becomes a health setback.",
  },
  {
    icon: ShieldCheck,
    title: "Private Health Workspace",
    status: "Now",
    body: "Keep sensitive health data in a focused dashboard built for decisions, not endless generic wellness content.",
  },
];

const PROCESS = [
  {
    step: "01",
    title: "Complete the assessment",
    body: "Start with core biometrics, lifestyle inputs, and optional labs or wearable metrics.",
  },
  {
    step: "02",
    title: "Review your age model",
    body: "See biological age, chronological delta, risk score, and how complete your data is.",
  },
  {
    step: "03",
    title: "Act on the protocol",
    body: "Follow a prioritized 90-day plan and refresh your profile as your metrics improve.",
  },
];

const PLANS = [
  {
    name: "Core",
    price: "$49",
    body: "For a clear baseline and a complete first report.",
    features: ["Biological age computation", "Full assessment", "AI longevity report"],
  },
  {
    name: "Elite",
    price: "$199",
    body: "For ongoing optimization and deeper intelligence.",
    features: ["Everything in Core", "Advanced biomarker analysis", "Daily intelligence alerts"],
    featured: true,
  },
  {
    name: "Sovereign",
    price: "$999",
    body: "For private, executive-level health intelligence.",
    features: ["Everything in Elite", "Unlimited AI analysis", "Physician-ready exports"],
  },
];

function ProductPreview() {
  return (
    <div className="premium-surface relative min-h-[480px] rounded-lg p-4">
      <div className="premium-gold-line absolute left-8 right-8 top-0 h-px" />
      <div className="relative grid h-full gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <aside className="rounded-md border border-white/10 bg-black/28 p-4">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-md bg-[rgb(236,220,184)] text-black">
              <Activity size={18} />
            </div>
            <div>
              <p className="text-xs font-medium text-white/80">Aeonvera</p>
              <p className="text-xs text-white/35">Private health desk</p>
            </div>
          </div>
          <div className="space-y-2">
            {["Overview", "Assessment", "Report", "Protocol"].map((item, index) => (
              <div
                key={item}
                className={`rounded-md px-3 py-2 text-sm ${
                  index === 0
                    ? "bg-[rgb(236,220,184)] text-black"
                    : "border border-white/8 bg-white/[0.018] text-white/45"
                }`}
              >
                {item}
              </div>
            ))}
          </div>
        </aside>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["Biological age", "37.8", "2.2 yrs younger"],
              ["Risk score", "28", "Low risk"],
              ["Accuracy", "84%", "High confidence"],
            ].map(([label, value, note]) => (
              <div key={label} className="rounded-md border border-white/10 bg-white/[0.045] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <p className="text-xs text-white/35">{label}</p>
                <p className="mt-3 text-3xl font-semibold tracking-normal text-white">{value}</p>
                <p className="mt-1 text-xs text-[rgba(236,220,184,0.62)]">{note}</p>
              </div>
            ))}
          </div>

          <div className="rounded-md border border-white/10 bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-white/80">Domain signal</p>
                <p className="text-xs text-white/35">Eight-system biological coverage</p>
              </div>
              <HeartPulse className="text-[rgba(212,175,55,0.72)]" size={20} />
            </div>
            <div className="space-y-3">
              {[
                ["Cardio", "86%"],
                ["Metabolic", "72%"],
                ["Sleep", "64%"],
                ["Movement", "91%"],
              ].map(([label, width]) => (
                <div key={label}>
                  <div className="mb-1 flex justify-between text-xs text-white/40">
                    <span>{label}</span>
                    <span>{width}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/8">
                    <div className="h-full rounded-full bg-[rgba(212,175,55,0.62)]" style={{ width }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-[rgba(236,220,184,0.14)] bg-[rgba(236,220,184,0.035)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <p className="text-sm font-medium text-[rgba(236,220,184,0.72)]">Next priority</p>
            <p className="mt-1 text-sm text-white/55">
              Improve sleep consistency to raise recovery score over the next 30 days.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [activeFeature, setActiveFeature] = useState(0);
  const [authenticated, setAuthenticated] = useState(false);
  const ActiveIcon = FEATURES[activeFeature].icon;

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % FEATURES.length);
    }, 5000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setAuthenticated(!!data.user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      setAuthenticated(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div>
      <section className="relative overflow-hidden px-6 py-20 lg:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="premium-chip mb-6 rounded-full px-3 py-1.5 text-xs">
              <ShieldCheck size={14} className="text-[rgba(212,175,55,0.72)]" />
              Private longevity intelligence
            </div>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[1.04] tracking-normal text-white md:text-7xl">
              Measure your biological age. Then move it.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/58">
              Aeonvera turns health data into a focused longevity dashboard:
              biological age, risk context, domain scoring, and a 90-day plan
              you can actually act on.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href={authenticated ? "/dashboard" : "/login?mode=signup"}
                className="premium-button-primary inline-flex h-12 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium transition hover:brightness-95"
              >
                {authenticated ? "Open dashboard" : "Start assessment"} <ArrowRight size={16} />
              </Link>
              <Link
                href="/pricing"
                className="premium-button-secondary inline-flex h-12 items-center justify-center rounded-md px-5 text-sm font-medium transition hover:border-white/25 hover:text-white"
              >
                Compare plans
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {STATS.map((stat) => (
                <div key={stat.label} className="premium-surface rounded-md p-4">
                  <p className="text-2xl font-semibold tracking-normal text-white">{stat.value}</p>
                  <p className="mt-1 text-xs uppercase tracking-normal text-white/35">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <ProductPreview />
        </div>
      </section>

      <section className="border-t border-white/8 px-6 py-18 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-9 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-xs uppercase tracking-normal text-[rgba(236,220,184,0.72)]">Clinical coverage</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-normal text-white md:text-5xl">
                Eight domains in one age model.
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-white/50">
              Most trackers isolate signals. Aeonvera combines the systems that
              determine healthspan and shows which ones deserve attention first.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {DOMAINS.map((domain) => (
              <div key={domain} className="premium-surface rounded-md p-4 text-sm text-white/70">
                {domain}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/8 px-6 py-18 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-xs uppercase tracking-normal text-[rgba(236,220,184,0.72)]">Platform</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal text-white md:text-5xl">
              Built for action, not passive tracking.
            </h2>
            <p className="mt-5 text-sm leading-7 text-white/50">
              Select an intelligence layer to see how the system turns raw
              inputs into a concrete next move.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-2">
              {FEATURES.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <button
                    key={feature.title}
                    onClick={() => setActiveFeature(index)}
                    className={`flex w-full items-center gap-3 rounded-md border p-4 text-left transition ${
                      activeFeature === index
                        ? "border-[rgba(212,175,55,0.28)] bg-[rgba(212,175,55,0.055)] shadow-[inset_0_1px_0_rgba(255,255,255,0.09)]"
                        : "border-white/10 bg-white/[0.025] hover:border-white/18 hover:bg-white/[0.04]"
                    }`}
                  >
                    <Icon size={18} className={activeFeature === index ? "text-[rgba(212,175,55,0.72)]" : "text-white/35"} />
                    <span className="text-sm text-white/75">{feature.title}</span>
                  </button>
                );
              })}
            </div>
            <div className="premium-surface rounded-lg p-6">
              <div className="mb-6 flex size-11 items-center justify-center rounded-md bg-[rgb(236,220,184)] text-black">
                <ActiveIcon size={21} />
              </div>
              <div className="premium-chip mb-3 rounded-full px-2.5 py-1 text-xs">
                {FEATURES[activeFeature].status}
              </div>
              <h3 className="text-2xl font-semibold tracking-normal text-white">
                {FEATURES[activeFeature].title}
              </h3>
              <p className="mt-4 text-sm leading-7 text-white/52">
                {FEATURES[activeFeature].body}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/8 px-6 py-18 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-9">
            <p className="text-xs uppercase tracking-normal text-[rgba(236,220,184,0.72)]">Workflow</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal text-white md:text-5xl">
              A clearer path from data to decisions.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {PROCESS.map((item) => (
              <div key={item.step} className="premium-surface rounded-md p-6">
                <p className="text-xs uppercase tracking-normal text-[rgba(212,175,55,0.72)]/65">{item.step}</p>
                <h3 className="mt-8 text-xl font-semibold tracking-normal text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-white/48">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/8 px-6 py-18 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-9 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-xs uppercase tracking-normal text-[rgba(236,220,184,0.72)]">Membership</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-normal text-white md:text-5xl">
                Pick the operating depth.
              </h2>
            </div>
            <Link href="/pricing" className="inline-flex items-center gap-2 text-sm font-medium text-white/65 hover:text-white">
              Full pricing <ArrowRight size={16} />
            </Link>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`premium-surface rounded-md p-6 ${
                  plan.featured
                    ? "border-[rgba(212,175,55,0.28)]"
                    : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold tracking-normal text-white">{plan.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/48">{plan.body}</p>
                  </div>
                  {plan.featured && <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-black">Preferred</span>}
                </div>
                <p className="mt-8 text-4xl font-semibold tracking-normal text-white">
                  {plan.price}<span className="text-sm font-normal text-white/35"> / mo</span>
                </p>
                <div className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-3 text-sm text-white/58">
                      <CircleCheck size={16} className="text-[rgba(236,220,184,0.62)]" />
                      {feature}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/8 px-6 py-18 lg:px-8">
        <div className="premium-surface mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 rounded-lg p-8 md:flex-row md:items-center">
          <div>
            <p className="text-xs uppercase tracking-normal text-[rgba(236,220,184,0.72)]">Begin</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal text-white">
              Get your first biological age readout.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/50">
              Start with the assessment, then generate a report when your baseline is ready.
            </p>
          </div>
          <Link
            href={authenticated ? "/assessment" : "/login?mode=signup"}
            className="premium-button-primary inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium transition hover:brightness-95"
          >
            {authenticated ? "Update assessment" : "Create account"} <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}
