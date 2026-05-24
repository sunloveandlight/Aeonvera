export default function AeonveraWebsite() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-black text-white selection:bg-white selection:text-black">
      {/* Background Effects */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-10%] top-[-10%] h-[500px] w-[500px] rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-zinc-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05),transparent_60%)]" />
        <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,0.4)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.4)_1px,transparent_1px)] [background-size:80px_80px]" />
      </div>

      {/* Navbar */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <div className="text-2xl font-semibold tracking-tight">Aeonvera</div>
          </div>

          <nav className="hidden items-center gap-10 text-sm text-zinc-300 md:flex">
            <a href="#platform" className="transition hover:text-white">
              Platform
            </a>
            <a href="#science" className="transition hover:text-white">
              Science
            </a>
            <a href="#membership" className="transition hover:text-white">
              Memberships
            </a>
            <a href="#about" className="transition hover:text-white">
              About
            </a>
          </nav>

          <div className="flex items-center gap-4">
            <button className="hidden text-sm text-zinc-400 transition hover:text-white md:block">
              Login
            </button>

            <button className="rounded-2xl border border-white/20 bg-white px-5 py-3 text-sm font-medium text-black transition hover:scale-105">
              Join Waitlist
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative flex min-h-screen items-center justify-center px-6 pt-40">
        <div className="relative z-10 mx-auto max-w-7xl">
          <div className="grid items-center gap-20 lg:grid-cols-2">
            {/* Left */}
            <div>
              <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm text-zinc-300 backdrop-blur-xl">
                AI-Native Longevity Intelligence
              </div>

              <h1 className="mt-8 text-6xl font-semibold leading-[0.95] tracking-tight md:text-8xl">
                Extend
                <br />
                Human
                <span className="bg-gradient-to-r from-white via-zinc-300 to-zinc-600 bg-clip-text text-transparent">
                  {" "}Healthspan
                </span>
              </h1>

              <p className="mt-8 max-w-2xl text-xl leading-relaxed text-zinc-400 md:text-2xl">
                Aeonvera predicts biological decline before symptoms emerge,
                generating adaptive longevity protocols powered by multimodal
                AI.
              </p>

              <div className="mt-12 flex flex-col gap-4 sm:flex-row">
                <button className="rounded-2xl bg-white px-8 py-5 text-lg font-medium text-black transition duration-300 hover:scale-105">
                  Request Early Access
                </button>

                <button className="rounded-2xl border border-white/10 bg-white/5 px-8 py-5 text-lg font-medium text-white backdrop-blur-xl transition hover:bg-white/10">
                  View Platform
                </button>
              </div>

              <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-3">
                {[
                  ["98%", "Predictive Accuracy"],
                  ["24/7", "Adaptive Intelligence"],
                  ["4.1 yrs", "Potential Healthspan Gain"],
                ].map(([stat, label]) => (
                  <div
                    key={label}
                    className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl"
                  >
                    <div className="text-3xl font-bold">{stat}</div>
                    <div className="mt-2 text-sm text-zinc-500">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Dashboard */}
            <div className="relative">
              <div className="absolute inset-0 rounded-[3rem] bg-gradient-to-br from-white/20 to-transparent blur-3xl" />

              <div className="relative rounded-[3rem] border border-white/10 bg-white/5 p-8 backdrop-blur-2xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-6">
                  <div>
                    <div className="text-sm text-zinc-500">
                      Biological Age
                    </div>
                    <div className="mt-2 text-6xl font-semibold">29.4</div>
                  </div>

                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-emerald-300">
                    -5.2 Years
                  </div>
                </div>

                <div className="mt-8 space-y-6">
                  {[
                    ["Recovery Score", "91%"],
                    ["Metabolic Efficiency", "87%"],
                    ["Cognitive Performance", "94%"],
                    ["Longevity Trajectory", "+12.6 yrs"],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div className="mb-3 flex items-center justify-between text-sm">
                        <span className="text-zinc-400">{label}</span>
                        <span className="text-white">{value}</span>
                      </div>

                      <div className="h-3 overflow-hidden rounded-full bg-white/5">
                        <div className="h-full w-4/5 rounded-full bg-gradient-to-r from-white to-zinc-500" />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-10 rounded-3xl border border-white/10 bg-black/40 p-6">
                  <div className="text-sm text-zinc-500">
                    AI Recommendation
                  </div>

                  <div className="mt-4 text-xl leading-relaxed text-zinc-200">
                    Increase deep sleep duration by 42 minutes to improve
                    recovery efficiency and reduce projected biological aging.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform */}
      <section id="platform" className="relative px-6 py-32">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <div className="text-sm uppercase tracking-[0.3em] text-zinc-500">
              The Platform
            </div>

            <h2 className="mt-6 text-5xl font-semibold leading-tight md:text-7xl">
              Your AI-Powered Longevity Operating System
            </h2>
          </div>

          <div className="mt-24 grid gap-8 md:grid-cols-2">
            {[
              {
                title: "Longevity Score",
                desc: "A continuously adaptive biomarker intelligence system measuring your rate of aging.",
              },
              {
                title: "Digital Twin",
                desc: "A predictive simulation layer modeling your future biological outcomes.",
              },
              {
                title: "Continuous Diagnostics",
                desc: "Integrate sleep, glucose, genomics, recovery, bloodwork, and activity into one intelligence graph.",
              },
              {
                title: "Longevity Co‑Pilot",
                desc: "Receive daily AI-driven recommendations personalized to your biology and performance goals.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="group rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/10 to-white/[0.03] p-10 transition duration-500 hover:-translate-y-2 hover:border-white/20"
              >
                <div className="text-3xl font-semibold transition group-hover:text-white">
                  {feature.title}
                </div>

                <p className="mt-5 text-lg leading-relaxed text-zinc-400">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Science */}
      <section
        id="science"
        className="border-y border-white/10 bg-zinc-950/80 px-6 py-32 backdrop-blur-xl"
      >
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <div className="text-sm uppercase tracking-[0.3em] text-zinc-500">
              Intelligence Layer
            </div>

            <h2 className="mt-6 text-5xl font-semibold md:text-7xl">
              Built for Predictive Biology
            </h2>
          </div>

          <div className="mt-24 grid gap-8 lg:grid-cols-3">
            {[
              {
                number: "01",
                title: "Connect Your Data",
                desc: "Integrate wearables, diagnostics, bloodwork, genomics, and recovery metrics.",
              },
              {
                number: "02",
                title: "AI Learns Your Biology",
                desc: "Aeonvera models your biological systems longitudinally to predict decline before symptoms emerge.",
              },
              {
                number: "03",
                title: "Optimize Daily",
                desc: "Adaptive recommendations continuously evolve as your biology changes.",
              },
            ].map((step) => (
              <div
                key={step.number}
                className="rounded-[2rem] border border-white/10 bg-black/60 p-10 backdrop-blur-xl"
              >
                <div className="text-sm text-zinc-500">{step.number}</div>

                <h3 className="mt-6 text-3xl font-semibold">
                  {step.title}
                </h3>

                <p className="mt-5 leading-relaxed text-zinc-400">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Memberships */}
      <section id="membership" className="px-6 py-32">
        <div className="mx-auto max-w-7xl text-center">
          <div className="text-sm uppercase tracking-[0.3em] text-zinc-500">
            Memberships
          </div>

          <h2 className="mt-6 text-5xl font-semibold md:text-7xl">
            Choose Your Longevity Tier
          </h2>

          <div className="mt-24 grid gap-8 lg:grid-cols-3">
            {[
              {
                name: "Core",
                price: "$49/mo",
                features: [
                  "Biological age tracking",
                  "Wearable integrations",
                  "AI health scoring",
                ],
              },
              {
                name: "Elite",
                price: "$199/mo",
                features: [
                  "Advanced diagnostics",
                  "Personalized protocols",
                  "Longevity Co‑Pilot",
                ],
                featured: true,
              },
              {
                name: "Sovereign",
                price: "$999/yr",
                features: [
                  "Executive optimization",
                  "Priority clinical access",
                  "Concierge longevity planning",
                ],
              },
            ].map((tier) => (
              <div
                key={tier.name}
                className={`rounded-[2.5rem] border p-10 text-left backdrop-blur-xl transition duration-500 hover:-translate-y-2 ${
                  tier.featured
                    ? "border-white/30 bg-white/10"
                    : "border-white/10 bg-white/5"
                }`}
              >
                {tier.featured && (
                  <div className="mb-6 inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm">
                    Most Popular
                  </div>
                )}

                <div className="text-3xl font-semibold">{tier.name}</div>

                <div className="mt-5 text-6xl font-bold">{tier.price}</div>

                <ul className="mt-10 space-y-5 text-zinc-400">
                  {tier.features.map((feature) => (
                    <li key={feature}>• {feature}</li>
                  ))}
                </ul>

                <button className="mt-12 w-full rounded-2xl bg-white px-6 py-5 font-medium text-black transition hover:scale-[1.02]">
                  Get Started
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-32">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[3rem] border border-white/10 bg-gradient-to-br from-zinc-900 to-black p-16 text-center">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-5xl font-semibold leading-tight md:text-8xl">
              Aging Is Inevitable.
              <br />
              Decline Is Increasingly Optional.
            </h2>

            <p className="mx-auto mt-8 max-w-3xl text-xl leading-relaxed text-zinc-400 md:text-2xl">
              Join the next generation of AI-powered preventative medicine,
              performance optimization, and predictive longevity intelligence.
            </p>

            <button className="mt-12 rounded-2xl bg-white px-10 py-5 text-lg font-semibold text-black transition duration-300 hover:scale-105">
              Request Early Access
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        id="about"
        className="border-t border-white/10 px-6 py-12"
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row">
          <div>
            <div className="text-2xl font-semibold tracking-tight">
              Aeonvera
            </div>

            <div className="mt-2 text-zinc-500">
              AI-Powered Longevity Intelligence
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-8 text-zinc-400">
            <a href="#platform" className="transition hover:text-white">
              Platform
            </a>
            <a href="#science" className="transition hover:text-white">
              Science
            </a>
            <a href="#membership" className="transition hover:text-white">
              Memberships
            </a>
            <a href="#about" className="transition hover:text-white">
              About
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
