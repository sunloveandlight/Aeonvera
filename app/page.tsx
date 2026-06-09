"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";

const STATS = [
  { value: "47", label: "Biomarkers tracked", suffix: "+" },
  { value: "8", label: "Health domains analyzed", suffix: "" },
  { value: "90", label: "Day optimization protocol", suffix: "-" },
  { value: "24", label: "Hour biological monitoring", suffix: "/7" },
];

const FEATURES = [
  {
    number: "01",
    title: "Biological Age Engine",
    body: "A clinical-grade algorithm computes your true biological age across cardiovascular, metabolic, cognitive, and lifestyle domains. Updated every time you add data.",
    tag: "Live Now",
    active: true,
  },
  {
    number: "02",
    title: "Proactive AI Coach",
    body: "Aeonvera doesn't wait for you to ask. It monitors your biological trends and sends targeted interventions at the right moment — before problems manifest.",
    tag: "Phase 3",
    active: false,
  },
  {
    number: "03",
    title: "Wearable Integration",
    body: "Oura, Apple Health, Whoop, and Garmin. Your biological data streams in continuously, keeping your model current without manual input.",
    tag: "Phase 2",
    active: false,
  },
  {
    number: "04",
    title: "Future Self Simulator",
    body: "Ask Aeonvera: what happens if I lose 20 pounds? If I improve VO2 max by 15%? The system projects your biological age trajectory forward.",
    tag: "Phase 5",
    active: false,
  },
  {
    number: "05",
    title: "Digital Twin",
    body: "A continuously updating simulation of your complete physiology. Every data point, intervention, and outcome builds a living model of your biological future.",
    tag: "Phase 6",
    active: false,
  },
];

const DOMAINS = [
  "Cardiovascular", "Metabolic", "Sleep & Recovery",
  "Exercise & Movement", "Nutrition", "Mental & Cognitive",
  "Body Composition", "Family & Genetics",
];

const PLAN_FEATURES = {
  core: [
    "Biological age computation",
    "Full assessment (47+ data points)",
    "AI longevity report",
    "Risk profile analysis",
    "90-day optimization protocol",
    "Dashboard access",
  ],
  elite: [
    "Everything in Core",
    "Advanced biomarker analysis",
    "Proactive AI coaching",
    "Daily intelligence alerts",
    "Behavioral pattern tracking",
    "Priority feature access",
  ],
  sovereign: [
    "Everything in Elite",
    "Unlimited AI analysis",
    "Digital twin modeling",
    "Executive health dashboard",
    "Physician-ready exports",
    "Concierge data integration",
    "Quarterly longevity reviews",
    "Family accounts",
    "Priority support",
  ],
};

export default function HomePage() {
  const [activeFeature, setActiveFeature] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % FEATURES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative">

      {/* ═══════════════════════════════════════
          HERO
      ═══════════════════════════════════════ */}
      <section className="min-h-screen flex flex-col justify-center relative overflow-hidden px-6 lg:px-8">
        <div className="max-w-7xl mx-auto w-full">

          {/* EYEBROW */}
          <div className={`flex items-center gap-3 mb-12 transition-all duration-1000 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            <div className="w-1.5 h-1.5 rounded-full bg-[rgba(212,175,55,0.7)] animate-pulse" />
            <p className="text-[10px] uppercase tracking-[0.7em] text-white/25">
              Private Biological Intelligence System
            </p>
          </div>

          {/* HEADLINE */}
          <h1 className={`text-6xl md:text-8xl lg:text-[9rem] font-light tracking-[-0.06em] leading-[0.95] text-white/90 mb-8 transition-all duration-1000 delay-100 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            Your biology
            <br />
            <span className="text-white/25">has an age.</span>
            <br />
            <span className="text-white/90">We measure it.</span>
          </h1>

          {/* SUBTEXT */}
          <p className={`max-w-2xl text-white/35 text-lg md:text-xl leading-relaxed mb-14 transition-all duration-1000 delay-200 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            Aeonvera is a continuously evolving longevity intelligence platform.
            It ingests your health data, computes your biological age across eight clinical domains,
            and generates personalized protocols to extend your healthspan.
          </p>

          {/* CTA ROW */}
          <div className={`flex flex-wrap items-center gap-4 mb-20 transition-all duration-1000 delay-300 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            <Link
              href="/login?mode=signup"
              className="px-8 py-4 rounded-full bg-white text-black text-sm font-light tracking-[0.1em] uppercase hover:bg-white/90 transition-all duration-300 shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
            >
              Compute Your Biological Age
            </Link>
            <Link
              href="/pricing"
              className="px-8 py-4 rounded-full border border-white/[0.08] text-white/40 text-sm font-light tracking-[0.1em] uppercase hover:border-white/20 hover:text-white/70 transition-all duration-300"
            >
              View Plans
            </Link>
          </div>

          {/* STATS ROW */}
          <div className={`grid grid-cols-2 md:grid-cols-4 gap-6 border-t border-white/[0.04] pt-10 transition-all duration-1000 delay-400 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            {STATS.map((stat, i) => (
              <div key={i}>
                <p className="text-4xl md:text-5xl font-light tracking-[-0.04em] text-white/80 mb-1">
                  {stat.value}
                  <span className="text-white/30">{stat.suffix}</span>
                </p>
                <p className="text-[10px] uppercase tracking-[0.4em] text-white/20">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ═══════════════════════════════════════
          WHAT IT MEASURES
      ═══════════════════════════════════════ */}
      <section className="py-32 md:py-44 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">

          <div className="max-w-3xl mb-20">
            <p className="text-[10px] uppercase tracking-[0.6em] text-white/20 mb-6">
              Clinical Coverage
            </p>
            <h2 className="text-4xl md:text-6xl font-light tracking-[-0.04em] text-white/85 leading-tight">
              Eight domains.
              <br />
              <span className="text-white/30">One biological age.</span>
            </h2>
            <p className="mt-6 text-white/30 text-lg leading-relaxed">
              Most health apps track one metric. Aeonvera synthesizes data
              across every major biological system to produce a single,
              clinically-informed number.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {DOMAINS.map((domain, i) => (
              <div
                key={i}
                className="p-5 rounded-2xl border border-white/[0.05] bg-white/[0.01] hover:border-white/[0.10] hover:bg-white/[0.03] transition-all duration-500 group"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[rgba(212,175,55,0.4)] mb-4 group-hover:bg-[rgba(212,175,55,0.8)] transition-colors duration-300" />
                <p className="text-white/50 text-sm font-light group-hover:text-white/70 transition-colors duration-300">
                  {domain}
                </p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ═══════════════════════════════════════
          FEATURE SHOWCASE
      ═══════════════════════════════════════ */}
      <section className="py-32 md:py-44 px-6 lg:px-8 border-t border-white/[0.03]">
        <div className="max-w-7xl mx-auto">

          <div className="max-w-3xl mb-20">
            <p className="text-[10px] uppercase tracking-[0.6em] text-white/20 mb-6">
              Platform Intelligence
            </p>
            <h2 className="text-4xl md:text-6xl font-light tracking-[-0.04em] text-white/85 leading-tight">
              Not an app.
              <br />
              <span className="text-white/30">A biological operating system.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-start">

            {/* LEFT — FEATURE LIST */}
            <div className="space-y-2">
              {FEATURES.map((feature, i) => (
                <button
                  key={i}
                  onClick={() => setActiveFeature(i)}
                  className={`w-full text-left p-6 rounded-2xl border transition-all duration-500 ${
                    activeFeature === i
                      ? "border-[rgba(212,175,55,0.2)] bg-[rgba(212,175,55,0.04)]"
                      : "border-white/[0.04] bg-transparent hover:border-white/[0.08]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] uppercase tracking-[0.4em] text-white/20">
                      {feature.number}
                    </span>
                    <span className={`text-[9px] px-2.5 py-1 rounded-full border uppercase tracking-[0.2em] ${
                      feature.active
                        ? "border-green-500/20 text-green-400 bg-green-500/[0.06]"
                        : "border-white/[0.06] text-white/20"
                    }`}>
                      {feature.tag}
                    </span>
                  </div>
                  <p className={`text-base font-light transition-colors duration-300 ${
                    activeFeature === i ? "text-white/85" : "text-white/40"
                  }`}>
                    {feature.title}
                  </p>
                </button>
              ))}
            </div>

            {/* RIGHT — FEATURE DETAIL */}
            <div className="md:sticky md:top-32">
              <div className="p-8 rounded-3xl border border-white/[0.05] bg-white/[0.01]">
                <div className="mb-6">
                  <span className="text-[9px] uppercase tracking-[0.5em] text-white/20">
                    {FEATURES[activeFeature].number}
                  </span>
                </div>
                <h3 className="text-3xl font-light tracking-[-0.03em] text-white/85 mb-4">
                  {FEATURES[activeFeature].title}
                </h3>
                <p className="text-white/35 leading-relaxed text-base">
                  {FEATURES[activeFeature].body}
                </p>
                <div className="mt-8 pt-6 border-t border-white/[0.04]">
                  <span className={`text-[9px] px-3 py-1.5 rounded-full border uppercase tracking-[0.3em] ${
                    FEATURES[activeFeature].active
                      ? "border-green-500/20 text-green-400 bg-green-500/[0.06]"
                      : "border-white/[0.06] text-white/20"
                  }`}>
                    {FEATURES[activeFeature].active ? "Available now" : FEATURES[activeFeature].tag}
                  </span>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ═══════════════════════════════════════
          HOW IT WORKS
      ═══════════════════════════════════════ */}
      <section className="py-32 md:py-44 px-6 lg:px-8 border-t border-white/[0.03]">
        <div className="max-w-7xl mx-auto">

          <div className="max-w-3xl mb-20">
            <p className="text-[10px] uppercase tracking-[0.6em] text-white/20 mb-6">
              The Process
            </p>
            <h2 className="text-4xl md:text-6xl font-light tracking-[-0.04em] text-white/85 leading-tight">
              From data
              <br />
              <span className="text-white/30">to biological intelligence.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                title: "Complete your assessment",
                body: "Answer questions across 8 clinical domains — lifestyle, sleep, exercise, nutrition, mental health, family history, and optionally your lab results.",
              },
              {
                step: "02",
                title: "Aeonvera computes your biological age",
                body: "A weighted multi-domain algorithm processes every data point and produces your biological age, risk profile, and accuracy score.",
              },
              {
                step: "03",
                title: "Receive your intelligence report",
                body: "A personalized 90-day optimization protocol, intervention priorities, behavioral insights, and a roadmap to reduce your biological age.",
              },
            ].map((item, i) => (
              <div key={i} className="relative p-8 rounded-3xl border border-white/[0.05] bg-white/[0.01]">
                <p className="text-[10px] uppercase tracking-[0.5em] text-white/15 mb-6">
                  {item.step}
                </p>
                <h3 className="text-xl font-light text-white/75 mb-4 leading-snug">
                  {item.title}
                </h3>
                <p className="text-white/30 text-sm leading-relaxed">
                  {item.body}
                </p>
                {i < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-px bg-white/[0.08]" />
                )}
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ═══════════════════════════════════════
          PRICING
      ═══════════════════════════════════════ */}
      <section className="py-32 md:py-44 px-6 lg:px-8 border-t border-white/[0.03]">
        <div className="max-w-7xl mx-auto">

          <div className="max-w-3xl mb-20">
            <p className="text-[10px] uppercase tracking-[0.6em] text-white/20 mb-6">
              Membership
            </p>
            <h2 className="text-4xl md:text-6xl font-light tracking-[-0.04em] text-white/85 leading-tight">
              Choose your
              <br />
              <span className="text-white/30">intelligence layer.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">

            {/* CORE */}
            <div className="p-8 rounded-3xl border border-white/[0.06] bg-white/[0.01]">
              <p className="text-[10px] uppercase tracking-[0.5em] text-white/25 mb-6">Core</p>
              <p className="text-5xl font-light tracking-[-0.04em] text-white/80 mb-1">$49</p>
              <p className="text-white/25 text-sm mb-8">per month</p>
              <div className="space-y-3 mb-8">
                {PLAN_FEATURES.core.map((f, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-1 h-1 rounded-full bg-white/20 shrink-0" />
                    <p className="text-white/40 text-sm">{f}</p>
                  </div>
                ))}
              </div>
              <Link
                href="/login?mode=signup"
                className="block w-full text-center py-3 rounded-xl border border-white/10 text-white/50 text-sm tracking-[0.1em] uppercase hover:border-white/25 hover:text-white/80 transition-all duration-300"
              >
                Get Core
              </Link>
            </div>

            {/* ELITE */}
            <div className="p-8 rounded-3xl border border-[rgba(212,175,55,0.2)] bg-[rgba(212,175,55,0.03)] relative">
              <div className="absolute top-6 right-6 px-3 py-1 rounded-full border border-[rgba(212,175,55,0.3)] bg-[rgba(212,175,55,0.08)]">
                <p className="text-[9px] uppercase tracking-[0.3em] text-[rgba(212,175,55,0.8)]">
                  Recommended
                </p>
              </div>
              <p className="text-[10px] uppercase tracking-[0.5em] text-[rgba(212,175,55,0.6)] mb-6">Elite</p>
              <p className="text-5xl font-light tracking-[-0.04em] text-white/80 mb-1">$199</p>
              <p className="text-white/25 text-sm mb-8">per month</p>
              <div className="space-y-3 mb-8">
                {PLAN_FEATURES.elite.map((f, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-1 h-1 rounded-full bg-[rgba(212,175,55,0.4)] shrink-0" />
                    <p className="text-white/50 text-sm">{f}</p>
                  </div>
                ))}
              </div>
              <Link
                href="/login?mode=signup"
                className="block w-full text-center py-3 rounded-xl border border-[rgba(212,175,55,0.3)] text-[rgba(212,175,55,0.8)] text-sm tracking-[0.1em] uppercase hover:border-[rgba(212,175,55,0.6)] hover:text-[rgba(212,175,55,1)] transition-all duration-300"
              >
                Get Elite
              </Link>
            </div>

            {/* SOVEREIGN */}
            <div className="p-8 rounded-3xl border border-white/[0.06] bg-white/[0.01]">
              <p className="text-[10px] uppercase tracking-[0.5em] text-white/25 mb-6">Sovereign</p>
              <p className="text-5xl font-light tracking-[-0.04em] text-white/80 mb-1">$999</p>
              <p className="text-white/25 text-sm mb-8">per month</p>
              <div className="space-y-3 mb-8">
                {PLAN_FEATURES.sovereign.map((f, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-1 h-1 rounded-full bg-white/20 shrink-0" />
                    <p className="text-white/40 text-sm">{f}</p>
                  </div>
                ))}
              </div>
              <Link
                href="/login?mode=signup"
                className="block w-full text-center py-3 rounded-xl border border-white/10 text-white/50 text-sm tracking-[0.1em] uppercase hover:border-white/25 hover:text-white/80 transition-all duration-300"
              >
                Get Sovereign
              </Link>
            </div>

          </div>

        </div>
      </section>

      {/* ═══════════════════════════════════════
          FINAL CTA
      ═══════════════════════════════════════ */}
      <section className="py-32 md:py-44 px-6 lg:px-8 border-t border-white/[0.03]">
        <div className="max-w-7xl mx-auto text-center">

          <p className="text-[10px] uppercase tracking-[0.7em] text-white/15 mb-8">
            Begin
          </p>

          <h2 className="text-5xl md:text-7xl font-light tracking-[-0.05em] text-white/85 leading-tight mb-8">
            Your biological age
            <br />
            <span className="text-white/25">is a choice.</span>
          </h2>

          <p className="text-white/30 text-lg leading-relaxed max-w-2xl mx-auto mb-14">
            The most powerful thing you can do for your health is know where
            you actually stand. Not where you think you stand.
            Aeonvera tells you the truth — and then helps you change it.
          </p>

          <Link
            href="/login?mode=signup"
            className="inline-flex items-center gap-3 px-10 py-5 rounded-full border border-[rgba(212,175,55,0.3)] text-[rgba(212,175,55,0.8)] text-sm font-light tracking-[0.15em] uppercase hover:border-[rgba(212,175,55,0.7)] hover:text-[rgba(212,175,55,1)] hover:bg-[rgba(212,175,55,0.04)] transition-all duration-500"
          >
            Compute Your Biological Age
          </Link>

        </div>
      </section>

    </div>
  );
}