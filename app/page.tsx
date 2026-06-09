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
        <div className="mx-auto max-w-6xl text-center">
          <div className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/64">
            <ShieldCheck size={16} className="text-[#2997ff]" />
            Private longevity intelligence
          </div>

          <h1 className="mx-auto max-w-5xl text-5xl font-semibold leading-[1.04] text-white md:text-5xl md:text-6xl lg:text-6xl md:text-5xl md:text-6xl">
            Know your biological age. Improve it with precision.
          </h1>

          <p className="mx-auto mt-7 max-w-3xl text-lg leading-8 text-white/58 md:text-xl">
            Aeonvera gives you a clean, decision-ready view of your healthspan:
            biological age, domain signals, risk context, and a practical plan.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={authenticated ? "/dashboard" : "/login?mode=signup"}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#2997ff] px-6 text-sm font-medium text-white transition hover:bg-[#147ce5] sm:w-auto"
            >
              {authenticated ? "Open dashboard" : "Start assessment"}
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-12 w-full items-center justify-center rounded-full border border-white/15 px-6 text-sm font-medium text-white/75 transition hover:border-white/25 hover:text-white sm:w-auto"
            >
              View plans
            </Link>
          </div>
        </div>
      </section>

      <section className="px-6 pb-24 lg:px-8">
        <div className="mx-auto max-w-6xl rounded-[28px] border border-white/10 bg-[#151517] p-6 md:p-8">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-white text-black">
                <Activity size={22} />
              </div>
              <h2 className="max-w-xl text-3xl font-semibold leading-tight md:text-5xl">
                A healthspan dashboard that stays out of your way.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-white/56">
                No decorative complexity. No noisy wellness feed. Just the
                numbers that matter, the domains behind them, and what to do next.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {METRICS.map(([value, label]) => (
                <div key={label} className="rounded-2xl bg-white/[0.055] p-5">
                  <p className="text-4xl font-semibold leading-none text-white">{value}</p>
                  <p className="mt-3 text-sm text-white/48">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/8 px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-[#2997ff]">Coverage</p>
              <h2 className="mt-4 text-3xl font-semibold leading-tight md:text-5xl">
                One model across eight clinical domains.
              </h2>
            </div>
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {DOMAINS.map((domain) => (
                <div key={domain} className="border-b border-white/10 pb-4 text-base text-white/72">
                  {domain}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/8 px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 max-w-3xl">
            <p className="text-sm font-medium text-[#2997ff]">Platform</p>
            <h2 className="mt-4 text-3xl font-semibold leading-tight md:text-5xl">
              Professional health intelligence, reduced to essentials.
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {CAPABILITIES.map((item) => (
              <div key={item.title} className="rounded-[24px] bg-[#151517] p-7">
                <Dna size={24} className="mb-8 text-white/68" />
                <h3 className="text-xl font-semibold text-white">{item.title}</h3>
                <p className="mt-4 text-sm leading-7 text-white/54">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/8 px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-[#2997ff]">Workflow</p>
              <h2 className="mt-4 text-3xl font-semibold leading-tight md:text-5xl">
                Built for repeatable progress.
              </h2>
            </div>
            <div className="space-y-6">
              {STEPS.map(([title, body], index) => (
                <div key={title} className="grid gap-4 border-b border-white/10 pb-6 sm:grid-cols-[80px_1fr]">
                  <p className="text-sm text-white/38">{String(index + 1).padStart(2, "0")}</p>
                  <div>
                    <h3 className="text-xl font-semibold text-white">{title}</h3>
                    <p className="mt-2 text-sm leading-7 text-white/54">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/8 px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-medium text-[#2997ff]">Membership</p>
              <h2 className="mt-4 text-3xl font-semibold leading-tight md:text-5xl">
                Choose your level of support.
              </h2>
            </div>
            <Link href="/pricing" className="inline-flex items-center gap-2 text-sm font-medium text-[#2997ff]">
              Full pricing <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {PLANS.map(([name, price, body]) => (
              <div key={name} className="rounded-[24px] bg-[#151517] p-7">
                <h3 className="text-xl font-semibold">{name}</h3>
                <p className="mt-6 text-4xl font-semibold">{price}</p>
                <p className="mt-4 text-sm leading-7 text-white/54">{body}</p>
                <div className="mt-8 flex items-center gap-2 text-sm text-white/64">
                  <Check size={16} />
                  Monthly membership
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/8 px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-4xl font-semibold leading-tight md:text-6xl">
            Start with the number that changes the conversation.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-white/56">
            Your biological age is the baseline. Aeonvera helps you make it useful.
          </p>
          <Link
            href={authenticated ? "/assessment" : "/login?mode=signup"}
            className="mt-9 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#2997ff] px-6 text-sm font-medium text-white transition hover:bg-[#147ce5]"
          >
            {authenticated ? "Update assessment" : "Get started"}
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}
