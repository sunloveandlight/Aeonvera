"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-white overflow-hidden">
      {/* Background Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_40%)] pointer-events-none" />

      {/* Navbar */}
      <header className="relative z-10 border-b border-white/10 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">
            Aeonvera
          </h1>

          <nav className="flex items-center gap-6">
            <Link
              href="/pricing"
              className="text-zinc-300 hover:text-white transition"
            >
              Pricing
            </Link>

            <Link
              href="/login"
              className="text-zinc-300 hover:text-white transition"
            >
              Login
            </Link>

            <Link
              href="/pricing"
              className="bg-white text-black px-5 py-2 rounded-xl font-medium hover:bg-zinc-200 transition"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 px-6 pt-32 pb-24">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 border border-white/10 bg-white/5 px-4 py-2 rounded-full text-sm text-zinc-300 mb-8 backdrop-blur-xl">
            Strategic Intelligence Platform
          </div>

          <h1 className="text-6xl md:text-8xl font-bold tracking-tight leading-none mb-8">
            Intelligence
            <br />
            For The Next Era
          </h1>

          <p className="max-w-2xl mx-auto text-xl text-zinc-400 leading-relaxed mb-10">
            Aeonvera combines AI systems, strategic workflows, and premium digital infrastructure into a unified operating platform for ambitious individuals.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/pricing"
              className="bg-white text-black px-8 py-4 rounded-2xl font-semibold text-lg hover:bg-zinc-200 transition w-full sm:w-auto text-center"
            >
              Start Your Access
            </Link>

            <Link
              href="/login"
              className="border border-white/10 bg-white/5 backdrop-blur-xl px-8 py-4 rounded-2xl font-semibold text-lg hover:bg-white/10 transition w-full sm:w-auto text-center"
            >
              Existing Member
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 px-6 py-24 border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <p className="text-zinc-500 uppercase tracking-[0.3em] text-sm mb-4">
              Capabilities
            </p>

            <h2 className="text-4xl md:text-5xl font-bold max-w-2xl">
              Built for high-performance thinking and execution.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-zinc-950 border border-white/10 rounded-3xl p-8">
              <div className="w-12 h-12 rounded-2xl bg-white/10 mb-6" />

              <h3 className="text-2xl font-semibold mb-4">
                AI Intelligence
              </h3>

              <p className="text-zinc-400 leading-relaxed">
                Advanced AI systems designed to support strategy, analysis, planning, and execution at scale.
              </p>
            </div>

            <div className="bg-zinc-950 border border-white/10 rounded-3xl p-8">
              <div className="w-12 h-12 rounded-2xl bg-white/10 mb-6" />

              <h3 className="text-2xl font-semibold mb-4">
                Strategic Systems
              </h3>

              <p className="text-zinc-400 leading-relaxed">
                Centralized workflows and premium digital infrastructure built for modern operators.
              </p>
            </div>

            <div className="bg-zinc-950 border border-white/10 rounded-3xl p-8">
              <div className="w-12 h-12 rounded-2xl bg-white/10 mb-6" />

              <h3 className="text-2xl font-semibold mb-4">
                Sovereign Access
              </h3>

              <p className="text-zinc-400 leading-relaxed">
                Premium-tier environments, exclusive tools, and elevated access for advanced members.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 py-32 border-t border-white/10">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-5xl md:text-6xl font-bold mb-8">
            Enter The System
          </h2>

          <p className="text-xl text-zinc-400 mb-10 max-w-2xl mx-auto">
            Access the next generation of AI-powered strategic infrastructure.
          </p>

          <Link
            href="/pricing"
            className="inline-flex bg-white text-black px-10 py-5 rounded-2xl text-lg font-semibold hover:bg-zinc-200 transition"
          >
            View Pricing
          </Link>
        </div>
      </section>
    </main>
  );
}