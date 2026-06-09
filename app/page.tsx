"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ArrowRight, Check, Dna, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

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

const PLANS = [
  ["Core", "$49", "Biological age, assessment, dashboard, and first report."],
  ["Elite", "$199", "Advanced biomarker analysis, alerts, and deeper reporting."],
  ["Sovereign", "$999", "Unlimited analysis, exports, and concierge-level support."],
];

function HeroVisual() {
  return (
    <div className="hero-stage relative overflow-hidden rounded-lg border border-white/10 p-6 md:p-8">
      <div className="relative z-10">
        <div className="mb-10 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white">Healthspan overview</p>
            <p className="mt-1 text-sm text-white/50">Updated from your latest assessment</p>
          </div>
          <div className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white/70">
            Optimal
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-2 lg:items-end">
          <div>
            <p className="text-sm text-white/50">Biological age</p>
            <div className="mt-3 flex items-end gap-3">
              <p className="text-6xl font-semibold leading-none md:text-7xl">38.4</p>
              <p className="pb-3 text-lg text-white/45">years</p>
            </div>
            <p className="mt-4 text-base text-white/60">
              2.6 years below chronological baseline.
            </p>
          </div>

          <div className="space-y-5">
            {[
              ["Cardiovascular", "86%"],
              ["Metabolic", "78%"],
              ["Recovery", "72%"],
              ["Movement", "91%"],
            ].map(([label, width]) => (
              <div key={label}>
                <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                  <span className="text-white/70">{label}</span>
                  <span className="text-white/40">{width}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="hero-pulse h-full origin-left rounded-full royal-gradient"
                    style={{ width }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          {[
            ["Risk score", "24", "low"],
            ["Accuracy", "84%", "high"],
            ["Priority", "Sleep", "next"],
          ].map(([label, value, note]) => (
            <div key={label} className="rounded-lg bg-black/25 p-4">
              <p className="text-sm text-white/40">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
              <p className="mt-1 text-sm text-white/40">{note}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [authenticated, setAuthenticated] = useState(false);

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
    <div className="text-white">
      <section className="px-6 pb-24 pt-24 lg:px-8 lg:pb-32 lg:pt-28">
        <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/60">
              <ShieldCheck size={16} className="royal-text" />
              Private longevity intelligence
            </div>

            <h1 className="max-w-4xl text-5xl font-semibold leading-[1.04] text-white md:text-6xl xl:text-7xl">
              Know your biological age. Improve it with precision.
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-white/60 md:text-xl">
              Aeonvera gives you a decision-ready view of your healthspan:
              biological age, domain signals, risk context, and a practical plan.
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link
                href={authenticated ? "/dashboard" : "/login?mode=signup"}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md royal-gradient px-6 text-sm font-medium text-white transition hover:opacity-95 sm:w-auto"
              >
                {authenticated ? "Open dashboard" : "Start assessment"}
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex h-12 w-full items-center justify-center rounded-md border border-white/15 px-6 text-sm font-medium text-white/75 transition hover:border-white/25 hover:text-white sm:w-auto"
              >
                View plans
              </Link>
            </div>
          </div>

          <HeroVisual />
        </div>
      </section>

      <section className="px-6 pb-24 lg:px-8">
        <div className="premium-surface mx-auto max-w-6xl rounded-lg p-6 md:p-8">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="mb-6 flex size-12 items-center justify-center rounded-lg bg-white text-black">
                <Activity size={22} />
              </div>
              <h2 className="max-w-xl text-3xl font-semibold leading-tight md:text-5xl">
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
                  <p className="text-4xl font-semibold leading-none text-white">{value}</p>
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
              <p className="text-sm font-medium royal-text">Coverage</p>
              <h2 className="mt-4 text-3xl font-semibold leading-tight md:text-5xl">
                One model across eight clinical domains.
              </h2>
            </div>
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {DOMAINS.map((domain) => (
                <div key={domain} className="border-b border-[rgba(36,50,74,0.12)] pb-4 text-base text-[rgba(16,24,39,0.72)]">
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
            <p className="text-sm font-medium royal-text">Platform</p>
            <h2 className="mt-4 text-3xl font-semibold leading-tight md:text-5xl">
              Professional health intelligence, reduced to essentials.
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {CAPABILITIES.map((item) => (
              <div key={item.title} className="premium-surface rounded-lg p-7 transition duration-300 hover:-translate-y-1">
                <Dna size={24} className="mb-8 text-[rgb(var(--royal))]" />
                <h3 className="text-xl font-semibold text-white">{item.title}</h3>
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
              <p className="text-sm font-medium royal-text">Workflow</p>
              <h2 className="mt-4 text-3xl font-semibold leading-tight md:text-5xl">
                Built for repeatable progress.
              </h2>
            </div>
            <div className="space-y-6">
              {STEPS.map(([title, body], index) => (
                <div key={title} className="grid gap-4 border-b border-[rgba(36,50,74,0.12)] pb-6 sm:grid-cols-[72px_1fr]">
                  <p className="text-sm text-[rgba(55,38,103,0.48)]">{String(index + 1).padStart(2, "0")}</p>
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

      <section className="border-t border-[rgba(36,50,74,0.1)] px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-medium royal-text">Membership</p>
              <h2 className="mt-4 text-3xl font-semibold leading-tight md:text-5xl">
                Choose your level of support.
              </h2>
            </div>
            <Link href="/pricing" className="inline-flex items-center gap-2 text-sm font-medium royal-text">
              Full pricing <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {PLANS.map(([name, price, body]) => (
              <div key={name} className="premium-surface rounded-lg p-7 transition duration-300 hover:-translate-y-1">
                <h3 className="text-xl font-semibold">{name}</h3>
                <p className="mt-6 text-4xl font-semibold">{price}</p>
                <p className="mt-4 text-sm leading-7 text-white/55">{body}</p>
                <div className="mt-8 flex items-center gap-2 text-sm text-white/60">
                  <Check size={16} />
                  Monthly membership
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[rgba(36,50,74,0.1)] px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-4xl font-semibold leading-tight md:text-6xl">
            Start with the number that changes the conversation.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-white/55">
            Your biological age is the baseline. Aeonvera helps you make it useful.
          </p>
          <Link
            href={authenticated ? "/assessment" : "/login?mode=signup"}
            className="mt-9 inline-flex h-12 items-center justify-center gap-2 rounded-md royal-gradient px-6 text-sm font-medium text-white transition hover:opacity-95"
          >
            {authenticated ? "Update assessment" : "Get started"}
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}
