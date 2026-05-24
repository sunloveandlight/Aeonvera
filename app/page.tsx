export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,255,255,0.12),transparent_40%)]" />

      <section className="relative flex min-h-screen items-center justify-center px-6">
        <div className="mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm tracking-[0.2em] text-zinc-300 backdrop-blur">
            AI • LONGEVITY • HUMAN OPTIMIZATION
          </div>

          <h1 className="mt-10 text-6xl font-bold leading-tight tracking-tight md:text-8xl">
            Aeonvera
          </h1>

          <p className="mx-auto mt-8 max-w-3xl text-xl leading-relaxed text-zinc-400 md:text-2xl">
            Building the future of AI-powered longevity intelligence.
            Predictive diagnostics, biological age modeling, and personalized
            health optimization for the next generation of human performance.
          </p>

          <div className="mt-14 flex flex-col items-center justify-center gap-5 sm:flex-row">
            <a
              href="mailto:hello@aeonvera.com?subject=Aeonvera%20Waitlist"
              className="rounded-2xl bg-white px-8 py-4 text-lg font-medium text-black transition hover:scale-105"
            >
              Join Waitlist
            </a>

            <a
              href="#platform"
              className="rounded-2xl border border-white/10 bg-white/5 px-8 py-4 text-lg font-medium text-white backdrop-blur transition hover:bg-white/10"
            >
              Explore Platform
            </a>
          </div>

          <div className="mt-24 grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur">
              <div className="text-4xl">🧬</div>
              <h3 className="mt-6 text-2xl font-semibold">
                Biological Age AI
              </h3>
              <p className="mt-4 text-zinc-400 leading-relaxed">
                Analyze biomarkers and lifestyle patterns to estimate true
                biological aging in real time.
              </p>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur">
              <div className="text-4xl">📈</div>
              <h3 className="mt-6 text-2xl font-semibold">
                Predictive Diagnostics
              </h3>
              <p className="mt-4 text-zinc-400 leading-relaxed">
                Identify future health risks before symptoms emerge through AI
                modeling and preventative analysis.
              </p>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur">
              <div className="text-4xl">⚡</div>
              <h3 className="mt-6 text-2xl font-semibold">
                Personalized Optimization
              </h3>
              <p className="mt-4 text-zinc-400 leading-relaxed">
                Receive intelligent daily recommendations for recovery,
                performance, sleep, nutrition, and longevity.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        id="platform"
        className="border-t border-white/10 px-6 py-28"
      >
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-16 md:grid-cols-2 md:items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">
                The Platform
              </p>

              <h2 className="mt-6 text-5xl font-semibold leading-tight md:text-6xl">
                Your Longevity Operating System
              </h2>

              <p className="mt-8 text-xl leading-relaxed text-zinc-400">
                Aeonvera combines AI, biomarkers, wearables, genomics, and
                preventative medicine into a unified intelligence platform for
                extending human healthspan.
              </p>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-zinc-900 to-black p-10">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-zinc-500">Biological Age</div>
                  <div className="mt-2 text-7xl font-bold">31.4</div>
                </div>

                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-3 text-emerald-300">
                  -4.1 years younger
                </div>
              </div>

              <div className="mt-12 space-y-5">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-zinc-300">
                  Sleep Optimization Score: 92/100
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-zinc-300">
                  Recovery Index: Excellent
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-zinc-300">
                  Metabolic Health Trending Positive
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row">
          <div>
            <div className="text-2xl font-semibold tracking-tight">
              Aeonvera
            </div>

            <div className="mt-2 text-zinc-500">
              AI-Powered Longevity Intelligence
            </div>
          </div>

          <div className="flex gap-8 text-zinc-400">
            <a href="#platform">Platform</a>
            <a href="mailto:hello@aeonvera.com">Contact</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
