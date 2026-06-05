"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-white overflow-hidden">
      {/* BACKGROUND */}
      <div className="fixed inset-0 -z-10 bg-black">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_35%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(255,255,255,0.03))]" />
      </div>

      {/* NAVBAR */}
      <header className="border-b border-white/10 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-[0.2em]">
              AEONVERA
            </h1>
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
              className="px-5 py-2 rounded-xl bg-white text-black text-sm font-medium hover:bg-zinc-200 transition"
            >
              Begin
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="px-6 pt-32 pb-28">
        <div className="max-w-6xl mx-auto text-center">
          <p className="uppercase tracking-[0.35em] text-zinc-500 text-sm mb-8">
            AI-NATIVE LONGEVITY INTELLIGENCE
          </p>

          <h1 className="text-6xl md:text-8xl font-bold leading-[0.95] tracking-tight max-w-6xl mx-auto">
            Extend human lifespan through intelligence.
          </h1>

          <p className="mt-10 text-xl md:text-2xl text-zinc-400 max-w-3xl mx-auto leading-relaxed">
            Aeonvera is building the intelligence infrastructure for human
            longevity — integrating AI systems, biological data, health
            optimization, and computational medicine into a unified platform.
          </p>

          <div className="mt-14 flex flex-col sm:flex-row gap-5 justify-center">
            <Link
              href="/login?mode=signup"
              className="px-8 py-4 rounded-2xl bg-white text-black font-semibold hover:bg-zinc-200 transition"
            >
              Access Platform
            </Link>

            <a
              href="#platform"
              className="px-8 py-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition"
            >
              Explore Platform
            </a>
          </div>
        </div>
      </section>

      {/* PLATFORM */}
      <section
        id="platform"
        className="px-6 py-28 border-t border-white/10"
      >
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mb-20">
            <p className="uppercase tracking-[0.3em] text-zinc-500 text-sm mb-6">
              PLATFORM
            </p>

            <h2 className="text-5xl md:text-6xl font-bold leading-tight">
              A biological intelligence operating system.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="rounded-3xl border border-white/10 bg-zinc-950/80 p-8">
              <div className="mb-6 text-zinc-500 text-sm uppercase tracking-[0.2em]">
                BIOMARKERS
              </div>

              <h3 className="text-2xl font-semibold mb-5">
                Biological Monitoring
              </h3>

              <p className="text-zinc-400 leading-relaxed">
                Centralize bloodwork, biomarkers, recovery metrics, and health
                data into a continuously evolving intelligence profile.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-zinc-950/80 p-8">
              <div className="mb-6 text-zinc-500 text-sm uppercase tracking-[0.2em]">
                AI SYSTEMS
              </div>

              <h3 className="text-2xl font-semibold mb-5">
                Longevity Intelligence
              </h3>

              <p className="text-zinc-400 leading-relaxed">
                AI-generated optimization protocols designed around cognition,
                recovery, metabolic health, sleep, and long-term lifespan.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-zinc-950/80 p-8">
              <div className="mb-6 text-zinc-500 text-sm uppercase tracking-[0.2em]">
                INFRASTRUCTURE
              </div>

              <h3 className="text-2xl font-semibold mb-5">
                Human Optimization Layer
              </h3>

              <p className="text-zinc-400 leading-relaxed">
                Build a personalized intelligence system capable of adapting to
                changing biological states over time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SCIENCE */}
      <section
        id="science"
        className="px-6 py-28 border-t border-white/10"
      >
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
          <div>
            <p className="uppercase tracking-[0.3em] text-zinc-500 text-sm mb-6">
              SCIENTIFIC FOUNDATION
            </p>

            <h2 className="text-5xl font-bold leading-tight mb-8">
              Computational longevity at scale.
            </h2>

            <p className="text-zinc-400 text-lg leading-relaxed mb-6">
              Aeonvera combines artificial intelligence, longitudinal health
              data, and optimization systems to create adaptive longevity
              intelligence.
            </p>

            <p className="text-zinc-400 text-lg leading-relaxed">
              The platform is designed to evolve into a unified infrastructure
              layer for preventive health, cognitive optimization, biomarker
              analysis, and biological age intervention systems.
            </p>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-zinc-950/80 p-10">
            <div className="space-y-10">
              <div>
                <div className="text-zinc-500 text-sm mb-2">
                  LONGITUDINAL DATA
                </div>

                <div className="text-3xl font-semibold">
                  Continuous Biological Tracking
                </div>
              </div>

              <div>
                <div className="text-zinc-500 text-sm mb-2">
                  AI REASONING
                </div>

                <div className="text-3xl font-semibold">
                  Adaptive Health Intelligence
                </div>
              </div>

              <div>
                <div className="text-zinc-500 text-sm mb-2">
                  OPTIMIZATION ENGINE
                </div>

                <div className="text-3xl font-semibold">
                  Personalized Longevity Protocols
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-36 border-t border-white/10">
        <div className="max-w-5xl mx-auto text-center">
          <p className="uppercase tracking-[0.3em] text-zinc-500 text-sm mb-6">
            BEGIN
          </p>

          <h2 className="text-5xl md:text-7xl font-bold leading-tight">
            Build your longevity intelligence layer.
          </h2>

          <p className="mt-8 text-zinc-400 text-xl max-w-2xl mx-auto leading-relaxed">
            Access the next generation of AI-powered biological optimization.
          </p>

          <div className="mt-12">
            <Link
              href="/login?mode=signup"
              className="inline-flex px-10 py-5 rounded-2xl bg-white text-black font-semibold hover:bg-zinc-200 transition"
            >
              Access Platform
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}