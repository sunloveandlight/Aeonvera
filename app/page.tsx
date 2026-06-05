"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#050507] text-white overflow-hidden relative">

      {/* GLOBAL BACKGROUND */}
      <div className="fixed inset-0 -z-10 bg-[#050507]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_40%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(255,255,255,0.02))]" />

        {/* subtle ambient light */}
        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-white/5 blur-[140px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-cyan-500/5 blur-[160px]" />
        </div>
      </div>

      {/* NAV */}
      <header className="border-b border-white/10 backdrop-blur-xl bg-black/20">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">

          <h1 className="text-sm tracking-[0.35em] font-medium">
            AEONVERA
          </h1>

          <nav className="hidden md:flex items-center gap-10 text-sm text-white/60">
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
              className="text-sm text-white/60 hover:text-white transition"
            >
              Sign In
            </Link>

            <Link
              href="/login?mode=signup"
              className="px-6 py-2.5 rounded-xl bg-white text-black text-sm font-medium hover:opacity-90 transition"
            >
              Begin
            </Link>
          </div>

        </div>
      </header>

      {/* HERO */}
      <section className="px-6 pt-28 pb-24">
        <div className="max-w-5xl mx-auto text-center">

          <p className="text-xs tracking-[0.4em] text-white/40 uppercase mb-8">
            AI-NATIVE LONGEVITY SYSTEM
          </p>

          <h1 className="text-6xl md:text-7xl font-semibold tracking-tight leading-[1.05]">
            Intelligence for human longevity.
          </h1>

          <p className="mt-8 text-lg md:text-xl text-white/60 max-w-3xl mx-auto leading-relaxed">
            Aeonvera unifies artificial intelligence, biological data, and
            computational health systems into a single longevity intelligence layer.
          </p>

          <div className="mt-12 flex flex-col sm:flex-row justify-center gap-4">

            <Link
              href="/login?mode=signup"
              className="px-8 py-3 rounded-xl bg-white text-black font-medium hover:opacity-90 transition"
            >
              Access Platform
            </Link>

            <a
              href="#platform"
              className="px-8 py-3 rounded-xl border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 transition"
            >
              Explore System
            </a>

          </div>
        </div>
      </section>

      {/* PLATFORM */}
      <section id="platform" className="px-6 py-24 border-t border-white/10">
        <div className="max-w-6xl mx-auto">

          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">
            A biological intelligence system
          </h2>

          <div className="grid md:grid-cols-3 gap-6 mt-14">

            {[
              {
                title: "Biological Monitoring",
                desc: "Unified biomarker, sleep, and metabolic tracking system.",
              },
              {
                title: "Longevity Intelligence",
                desc: "AI models that optimize healthspan and performance.",
              },
              {
                title: "Adaptive Infrastructure",
                desc: "A system that evolves with your biology over time.",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="p-8 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl"
              >
                <h3 className="text-lg font-medium mb-3">
                  {item.title}
                </h3>
                <p className="text-white/60 text-sm leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}

          </div>

        </div>
      </section>

      {/* SCIENCE */}
      <section id="science" className="px-6 py-24 border-t border-white/10">
        <div className="max-w-5xl mx-auto text-center">

          <h2 className="text-4xl md:text-5xl font-semibold">
            Computational longevity infrastructure
          </h2>

          <p className="mt-8 text-white/60 leading-relaxed">
            Built on longitudinal data systems, predictive modeling, and AI-driven
            health optimization frameworks.
          </p>

        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-28 border-t border-white/10">
        <div className="max-w-4xl mx-auto text-center">

          <h2 className="text-5xl font-semibold tracking-tight">
            Build your longevity layer.
          </h2>

          <p className="mt-6 text-white/60">
            Start using Aeonvera’s intelligence system today.
          </p>

          <div className="mt-10">
            <Link
              href="/login?mode=signup"
              className="px-8 py-3 rounded-xl bg-white text-black font-medium hover:opacity-90 transition"
            >
              Access Platform
            </Link>
          </div>

        </div>
      </section>

    </main>
  );
}