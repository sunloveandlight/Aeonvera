export default function Home() {
  const features = [
    {
      title: "Biological Age AI",
      description:
        "Continuously analyze biomarkers and lifestyle data to estimate biological aging.",
    },
    {
      title: "Predictive Diagnostics",
      description:
        "Identify future health risks before symptoms emerge through AI-driven modeling.",
    },
    {
      title: "Personalized Protocols",
      description:
        "Receive daily optimization recommendations tailored to your physiology.",
    },
  ];

  const metrics = [
    { label: "Sleep Score", value: "92/100" },
    { label: "Recovery", value: "88/100" },
    { label: "Metabolic", value: "94/100" },
  ];

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="relative overflow-hidden px-6 py-28">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 to-transparent" />

        <div className="relative mx-auto max-w-6xl text-center">
          <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300 backdrop-blur">
            AI-Powered Longevity Intelligence
          </div>

          <h1 className="mx-auto mt-8 max-w-5xl text-6xl font-bold leading-tight md:text-8xl">
            Extend Human Healthspan
          </h1>

          <p className="mx-auto mt-8 max-w-3xl text-xl leading-relaxed text-zinc-400 md:text-2xl">
            Aeonvera combines artificial intelligence, biomarker analysis,
            and preventative health optimization to help humans live longer,
            healthier lives.
          </p>

          <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="mailto:hello@aeonvera.com?subject=Join%20Aeonvera%20Waitlist"
              className="rounded-2xl bg-white px-8 py-4 text-lg font-medium text-black transition hover:scale-105"
            >
              Join Waitlist
            </a>

            <a
              href="#platform"
              className="rounded-2xl border border-white/10 bg-white/5 px-8 py-4 text-lg font-medium backdrop-blur transition hover:bg-white/10"
            >
              View Platform
            </a>
          </div>

          <div className="mt-20 grid grid-cols-1 gap-6 md:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur"
              >
                <h3 className="text-2xl font-semibold">
                  {feature.title}
                </h3>

                <p className="mt-4 text-zinc-400">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-zinc-950 px-6 py-28">
        <div className="mx-auto grid max-w-6xl gap-16 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">
              Why Aeonvera Exists
            </p>

            <h2 className="mt-6 text-5xl font-semibold leading-tight md:text-6xl">
              Healthcare Should Predict Decline — Not React To It.
            </h2>

            <p className="mt-8 text-xl leading-relaxed text-zinc-400">
              Aeonvera was founded on the belief that aging can be modeled,
              optimized, and slowed through continuous intelligence.
            </p>

            <p className="mt-6 text-lg leading-relaxed text-zinc-500">
              By combining AI, biomarkers, wearables, genomics, and
              preventative medicine, Aeonvera creates a personalized operating
              system for extending human healthspan.
            </p>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-10 backdrop-blur">
            <div className="text-sm uppercase tracking-[0.2em] text-cyan-300">
              Core Thesis
            </div>

            <div className="mt-8 space-y-5">
              {[
                "Aging is measurable",
                "Biology can be modeled with AI",
                "Preventative medicine will replace reactive healthcare",
                "Personalized optimization will become the new standard",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-black/30 p-5 text-zinc-300"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="platform" className="px-6 py-28">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">
              AI Longevity Dashboard
            </p>

            <h2 className="mt-4 text-5xl font-semibold md:text-6xl">
              Your Biological Age
            </h2>
          </div>

          <div className="mt-20 grid gap-8 md:grid-cols-[1.2fr_0.8fr]">
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

              <div className="mt-12 h-4 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-cyan-400 to-white" />
              </div>

              <div className="mt-10 grid gap-6 md:grid-cols-3">
                {metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-2xl border border-white/10 bg-white/5 p-6"
                  >
                    <div className="text-zinc-500">{metric.label}</div>
                    <div className="mt-3 text-3xl font-semibold">
                      {metric.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-10 backdrop-blur">
              <div className="text-sm uppercase tracking-[0.2em] text-zinc-500">
                AI Recommendations
              </div>

              <div className="mt-8 space-y-5">
                {[
                  "Increase deep sleep consistency by 14%",
                  "Reduce evening glucose spikes",
                  "Optimize HRV recovery window",
                  "Add zone 2 cardio 3x weekly",
                ].map((tip) => (
                  <div
                    key={tip}
                    className="rounded-2xl border border-white/10 bg-black/30 p-5 text-zinc-300"
                  >
                    {tip}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 px-6 py-24">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-5xl font-semibold md:text-6xl">
            Join the Future of Human Optimization
          </h2>

          <p className="mt-6 text-xl text-zinc-400">
            Join the next generation of AI-powered preventative health and
            longevity intelligence.
          </p>

          <a
            href="mailto:hello@aeonvera.com?subject=Request%20Early%20Access"
            className="mt-12 inline-block rounded-2xl bg-white px-10 py-5 text-lg font-medium text-black transition hover:scale-105"
          >
            Request Early Access
          </a>
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
            <a href="#">About</a>
            <a href="#platform">Platform</a>
            <a href="#">Research</a>
            <a href="mailto:hello@aeonvera.com">Contact</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
