export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(120,119,198,0.18),transparent_45%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(0,255,255,0.08),transparent_40%)]" />

      <section className="relative flex min-h-screen items-center justify-center px-6">
        <div className="mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm tracking-[0.35em] text-zinc-300 backdrop-blur-xl">
            AI • LONGEVITY • HUMAN OPTIMIZATION
          </div>

          <h1 className="mt-10 text-7xl font-semibold tracking-[-0.06em] text-white md:text-[10rem]">
            Aeonvera
          </h1>

          <p className="mx-auto mt-8 max-w-3xl text-xl leading-relaxed text-zinc-400 md:text-2xl">
            Building the future of AI-powered longevity intelligence through
            predictive diagnostics, biological age modeling, and personalized
            health optimization.
          </p>

          <div className="mt-14 flex flex-col items-center justify-center gap-5 sm:flex-row">
            <a
              href="mailto:hello@aeonvera.com?subject=Aeonvera%20Waitlist"
              className="rounded-2xl bg-white px-8 py-4 text-lg font-medium text-black transition duration-300 hover:scale-105 hover:bg-zinc-200"
            >
              Join Waitlist
            </a>

            <a
              href="#platform"
              className="rounded-2xl border border-white/10 bg-white/5 px-8 py-4 text-lg font-medium text-white backdrop-blur-xl transition duration-300 hover:bg-white/10"
            >
              Explore Platform
            </a>
          </div>

          <div className="mt-24 grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl transition hover:border-cyan-400/30 hover:bg-white/[0.05]">
              <div className="text-sm uppercase tracking-[0.3em] text-cyan-300">
                Intelligence
              </div>

              <h3 className="mt-5 text-2xl font-semibold">
                Biological Age AI
              </h3>

              <p className="mt-4 leading-relaxed text-zinc-400">
                Analyze biomarkers and lifestyle patterns to estimate true
                biological aging in real time.
              </p>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl transition hover:border-cyan-400/30 hover:bg-white/[0.05]">
              <div className="text-sm uppercase tracking-[0.3em] text-cyan-300">
                Diagnostics
              </div>

              <h3 className="mt-5 text-2xl font-semibold">
                Predictive Health
              </h3>

              <p className="mt-4 leading-relaxed text-zinc-400">
                Identify future health risks before symptoms emerge through AI
                modeling and preventative analysis.
              </p>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl transition hover:border-cyan-400/30 hover:bg-white/[0.05]">
              <div className="text-sm uppercase tracking-[0.3em] text-cyan-300">
                Optimization
              </div>

              <h3 className="mt-5 text-2xl font-semibold">
                Personalized Protocols
              </h3>

              <p className="mt-4 leading-relaxed text-zinc-400">
                Receive intelligent recommendations for sleep, recovery,
                nutrition, performance, and long-term vitality.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        id="platform"
        className="relative border-t border-white/10 px-6 py-28"
      >
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-14 md:grid-cols-2 md:items-center">
            <div>
              <div className="text-sm uppercase tracking-[0.3em] text-zinc-500">
                The Platform
              </div>

              <h2 className="mt-6 text-5xl font-semibold leading-tight tracking-[-0.04em] md:text-6xl">
                Your Longevity Operating System
              </h2>

              <p className="mt-8 text-xl leading-relaxed text-zinc-400">
                Aeonvera combines AI, biomarkers, wearables, genomics, and
                preventative medicine into one unified intelligence platform
                designed to extend human healthspan.
              </p>

              <div className="mt-10 flex flex-wrap gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-zinc-300 backdrop-blur-xl">
                  Sleep Optimization
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-zinc-300 backdrop-blur-xl">
                  Recovery Intelligence
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-zinc-300 backdrop-blur-xl">
                  Biomarker Tracking
                </div>
              </div>
            </div>

            <div className="rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-10 backdrop-blur-2xl">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-zinc-500">Biological Age</div>
                  <div className="mt-3 text-8xl font-semibold tracking-[-0.08em]">
                    31.4
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
                  -4.1 years younger
                </div>
              </div>

              <div className="mt-12 h-3 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-[74%] rounded-full bg-gradient-to-r from-cyan-400 to-white" />
              </div>

              <div className="mt-12 space-y-5">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-zinc-300">
                  Sleep Optimization Score: 92/100
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-zinc-300">
                  Recovery Index: Excellent
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-zinc-300">
                  Metabolic Health Trending Positive
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative border-t border-white/10 px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row">
          <div>
            <div className="text-2xl font-semibold tracking-tight">
              Aeonvera
            </div>

            <div className="mt-2 text-zinc-500">
              AI-Powered Longevity Intelligence
            </div>
          </div>

          <div className="flex items-center gap-8 text-zinc-400">
            <a href="#platform" className="transition hover:text-white">
              Platform
            </a>

            <a
              href="mailto:hello@aeonvera.com"
              className="transition hover:text-white"
            >
              Contact
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
