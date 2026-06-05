"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#050507] text-white overflow-hidden relative">

      {/* =========================
          LUXURY BACKGROUND LAYER
      ========================== */}
      <div className="fixed inset-0 -z-10">
        {/* base gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-black via-[#050507] to-black" />

        {/* soft radial luxury glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.10),transparent_40%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(120,180,255,0.08),transparent_45%)]" />

        {/* gold / platinum aurora */}
        <div className="absolute inset-0 opacity-[0.25] mix-blend-screen">
          <div className="absolute top-[-15%] left-[-10%] w-[60%] h-[60%] bg-gradient-to-r from-white/10 via-yellow-200/10 to-transparent blur-[140px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-gradient-to-r from-white/10 via-cyan-200/10 to-transparent blur-[160px]" />
        </div>

        {/* subtle grain feel */}
        <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]" />
      </div>

      {/* =========================
              NAVBAR
      ========================== */}
      <header className="border-b border-white/10 backdrop-blur-xl bg-black/20">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">

          <div className="tracking-[0.35em] text-sm font-light">
            <span className="bg-gradient-to-r from-white via-yellow-100 to-white bg-clip-text text-transparent">
              AEONVERA
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-10 text-sm text-zinc-400">
            <a href="#platform" className="hover:text-white transition">
              Platform
            </a>
            <a href="#science" className="hover:text-white transition">
              Science
            </a>
            <Link href="/pricing" className="hover:text-white transition">
              Pricing
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <Link
              href="/login?mode=signin"
              className="text-sm text-zinc-400 hover:text-white transition"
            >
              Sign In
            </Link>

            <Link
              href="/login?mode=signup"
              className="px-5 py-2 rounded-xl bg-white text-black text-sm font-medium hover:scale-[1.02] transition shadow-[0_0_25px_rgba(255,255,255,0.12)]"
            >
              Begin
            </Link>
          </div>
        </div>
      </header>

      {/* =========================
              HERO
      ========================== */}
      <section className="px-6 pt-36 pb-32">
        <div className="max-w-6xl mx-auto text-center">

          <p className="uppercase tracking-[0.5em] text-zinc-500 text-xs mb-10">
            AI • BIOLOGICAL INTELLIGENCE • LONGEVITY SYSTEM
          </p>

          <h1 className="text-6xl md:text-8xl font-semibold leading-[0.95] tracking-tight">
            <span className="bg-gradient-to-r from-white via-yellow-100 via-50% to-cyan-100 bg-clip-text text-transparent">
              Extend human lifespan
            </span>
            <br />
            <span className="text-white/80 font-light">
              through intelligence.
            </span>
          </h1>

          <p className="mt-10 text-lg md:text-xl text-zinc-400 max-w-3xl mx-auto leading-relaxed">
            Aeonvera is a computational longevity system — unifying AI,
            biological data, and adaptive health modeling into a single
            intelligence layer for human optimization.
          </p>

          <div className="mt-14 flex flex-col sm:flex-row gap-5 justify-center">
            <Link
              href="/login?mode=signup"
              className="px-9 py-4 rounded-2xl bg-white text-black font-medium hover:scale-[1.02] transition shadow-[0_0_40px_rgba(255,255,255,0.15)]"
            >
              Access Platform
            </Link>

            <a
              href="#platform"
              className="px-9 py-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition text-white/80"
            >
              Explore System
            </a>
          </div>
        </div>
      </section>

      {/* =========================
            PLATFORM SECTION
      ========================== */}
      <section id="platform" className="px-6 py-28 border-t border-white/10">
        <div className="max-w-7xl mx-auto">

          <div className="max-w-3xl mb-20">
            <p className="uppercase tracking-[0.4em] text-zinc-500 text-xs mb-6">
              PLATFORM
            </p>

            <h2 className="text-5xl md:text-6xl font-semibold leading-tight">
              A biological intelligence operating system.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">

            {[
              {
                title: "Biological Monitoring",
                tag: "BIOMARKERS",
                desc: "Unified tracking of biomarkers, recovery, sleep, and metabolic health into a continuously evolving intelligence layer.",
              },
              {
                title: "Longevity Intelligence",
                tag: "AI SYSTEMS",
                desc: "Adaptive AI models generating optimization protocols for cognition, energy, and lifespan extension.",
              },
              {
                title: "Adaptive Health Layer",
                tag: "INFRASTRUCTURE",
                desc: "A persistent system that evolves with your biological state over time.",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl hover:scale-[1.02] transition"
              >
                <div className="text-xs tracking-[0.3em] text-zinc-500 mb-5">
                  {item.tag}
                </div>

                <h3 className="text-2xl font-medium mb-4">
                  {item.title}
                </h3>

                <p className="text-zinc-400 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}

          </div>
        </div>
      </section>

      {/* =========================
              SCIENCE
      ========================== */}
      <section id="science" className="px-6 py-28 border-t border-white/10">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-20 items-center">

          <div>
            <p className="uppercase tracking-[0.4em] text-zinc-500 text-xs mb-6">
              SCIENTIFIC FOUNDATION
            </p>

            <h2 className="text-5xl font-semibold mb-8">
              Computational longevity infrastructure.
            </h2>

            <p className="text-zinc-400 text-lg leading-relaxed mb-6">
              Aeonvera integrates artificial intelligence with longitudinal
              biological datasets to model human health trajectories and
              intervention outcomes.
            </p>

            <p className="text-zinc-400 text-lg leading-relaxed">
              The system functions as an adaptive intelligence layer for
              predictive health, biological optimization, and lifespan
              engineering.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-10 backdrop-blur-xl space-y-10">

            {[
              "Continuous Biological Tracking",
              "Adaptive AI Reasoning",
              "Personalized Longevity Protocols",
            ].map((t, i) => (
              <div key={i}>
                <p className="text-xs tracking-[0.3em] text-zinc-500 mb-2">
                  SYSTEM MODULE
                </p>
                <p className="text-2xl font-medium">{t}</p>
              </div>
            ))}

          </div>

        </div>
      </section>

      {/* =========================
                CTA
      ========================== */}
      <section className="px-6 py-36 border-t border-white/10">
        <div className="max-w-5xl mx-auto text-center">

          <p className="uppercase tracking-[0.4em] text-zinc-500 text-xs mb-6">
            BEGIN
          </p>

          <h2 className="text-5xl md:text-7xl font-semibold leading-tight">
            Build your longevity intelligence layer.
          </h2>

          <p className="mt-8 text-zinc-400 text-lg max-w-2xl mx-auto">
            Access next-generation AI-powered biological optimization systems.
          </p>

          <div className="mt-12">
            <Link
              href="/login?mode=signup"
              className="inline-flex px-10 py-5 rounded-2xl bg-white text-black font-medium hover:scale-[1.02] transition shadow-[0_0_45px_rgba(255,255,255,0.15)]"
            >
              Access Platform
            </Link>
          </div>

        </div>
      </section>

    </main>
  );
}