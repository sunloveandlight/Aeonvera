export default function AeonveraWebsite() {
  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-x-hidden">
      {/* Hero */}
      <section className="relative flex min-h-screen items-center justify-center px-6 py-24">
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 via-black to-black opacity-90" />

        <div className="relative z-10 max-w-6xl text-center">
          <div className="mb-6 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300 backdrop-blur">
            AI-Native Longevity Intelligence
          </div>

          <h1 className="mx-auto max-w-5xl text-6xl font-semibold leading-tight tracking-tight md:text-8xl">
            Extend Human
            <span className="bg-gradient-to-r from-white via-zinc-300 to-zinc-500 bg-clip-text text-transparent">
              {" "}Healthspan
            </span>
          </h1>

          <p className="mx-auto mt-8 max-w-3xl text-xl leading-relaxed text-zinc-400 md:text-2xl">
            Aeonvera uses AI to predict biological decline, optimize performance,
            and personalize longevity protocols for a healthier future.
          </p>

          <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button className="rounded-2xl bg-white px-8 py-4 text-lg font-medium text-black transition hover:scale-105">
              Join Waitlist
            </button>

            <button className="rounded-2xl border border-white/20 bg-white/5 px-8 py-4 text-lg font-medium text-white backdrop-blur transition hover:bg-white/10">
              View Platform
            </button>
          </div>

          <div className="mt-20 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              {
                title: "Biological Age AI",
                desc: "Continuously track how fast your body is aging.",
              },
              {
                title: "Predictive Diagnostics",
                desc: "Forecast disease risks before symptoms emerge.",
              },
              {
                title: "Personalized Protocols",
                desc: "Daily optimization plans powered by multimodal AI.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur"
              >
                <h3 className="text-2xl font-semibold">{item.title}</h3>
                <p className="mt-4 text-zinc-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-white/10 bg-zinc-950 px-6 py-20">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-10 md:grid-cols-4">
          {[
            ["98%", "Data Accuracy"],
            ["24/7", "AI Optimization"],
            ["1M+", "Projected Users"],
            ["4.1 yrs", "Potential Biological Age Reduction"],
          ].map(([stat, label]) => (
            <div key={label} className="text-center">
              <div className="text-5xl font-bold">{stat}</div>
              <div className="mt-3 text-zinc-400">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Platform */}
      <section className="px-6 py-28">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">
              The Platform
            </p>
            <h2 className="mt-4 text-5xl font-semibold leading-tight md:text-6xl">
              Your AI-Powered Longevity Operating System
            </h2>
          </div>

          <div className="mt-20 grid gap-8 md:grid-cols-2">
            {[
              {
                title: "Longevity Score",
                desc: "A dynamic score that tracks your aging trajectory using biomarker and wearable data.",
              },
              {
                title: "Digital Twin",
                desc: "Create a predictive AI model of your body and simulate future health outcomes.",
              },
              {
                title: "Continuous Diagnostics",
                desc: "Integrate bloodwork, sleep, glucose, exercise, and genomics into one intelligence layer.",
              },
              {
                title: "Longevity Co‑Pilot",
                desc: "Daily recommendations for sleep, recovery, nutrition, stress, and supplementation.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-10"
              >
                <h3 className="text-3xl font-semibold">{feature.title}</h3>
                <p className="mt-5 text-lg leading-relaxed text-zinc-400">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="bg-zinc-950 px-6 py-28">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">
              How It Works
            </p>
            <h2 className="mt-4 text-5xl font-semibold md:text-6xl">
              Intelligence Layer for Human Biology
            </h2>
          </div>

          <div className="mt-20 grid gap-8 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Connect Your Data",
                desc: "Sync wearables, blood panels, genomics, and lifestyle metrics.",
              },
              {
                step: "02",
                title: "AI Analyzes Your Biology",
                desc: "Aeonvera builds a longitudinal model of your health and aging.",
              },
              {
                step: "03",
                title: "Optimize Daily",
                desc: "Receive precision recommendations to improve healthspan and performance.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-3xl border border-white/10 bg-black p-10"
              >
                <div className="text-sm text-zinc-500">{item.step}</div>
                <h3 className="mt-6 text-3xl font-semibold">{item.title}</h3>
                <p className="mt-4 text-zinc-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="px-6 py-28">
        <div className="mx-auto max-w-6xl text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">
            Memberships
          </p>
          <h2 className="mt-4 text-5xl font-semibold md:text-6xl">
            Choose Your Longevity Tier
          </h2>

          <div className="mt-20 grid gap-8 md:grid-cols-3">
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
                  "Longevity Co‑Pilot",
                  "Advanced diagnostics",
                  "Personalized protocols",
                ],
              },
              {
                name: "Sovereign",
                price: "$999/yr",
                features: [
                  "Concierge optimization",
                  "Priority clinical access",
                  "Executive performance plans",
                ],
              },
            ].map((tier) => (
              <div
                key={tier.name}
                className="rounded-[2rem] border border-white/10 bg-white/5 p-10 text-left backdrop-blur"
              >
                <div className="text-2xl font-semibold">{tier.name}</div>
                <div className="mt-4 text-5xl font-bold">{tier.price}</div>

                <ul className="mt-8 space-y-4 text-zinc-400">
                  {tier.features.map((feature) => (
                    <li key={feature}>• {feature}</li>
                  ))}
                </ul>

                <button className="mt-10 w-full rounded-2xl bg-white px-6 py-4 font-medium text-black transition hover:scale-[1.02]">
                  Get Started
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-28">
        <div className="mx-auto max-w-6xl rounded-[3rem] border border-white/10 bg-gradient-to-br from-zinc-900 to-black p-16 text-center">
          <h2 className="mx-auto max-w-4xl text-5xl font-semibold leading-tight md:text-7xl">
            Aging Is Inevitable.
            <br />
            Decline Is Increasingly Optional.
          </h2>

          <p className="mx-auto mt-8 max-w-2xl text-xl text-zinc-400">
            Join the next generation of AI-powered preventative medicine and
            human optimization.
          </p>

          <button className="mt-12 rounded-2xl bg-white px-10 py-5 text-lg font-semibold text-black transition hover:scale-105">
            Request Early Access
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
          <div>
            <div className="text-2xl font-semibold tracking-tight">Aeonvera</div>
            <div className="mt-2 text-zinc-500">
              AI-Powered Longevity Intelligence
            </div>
          </div>

          <div className="flex gap-8 text-zinc-400">
            <a href="#">Platform</a>
            <a href="#">Research</a>
            <a href="#">Clinics</a>
            <a href="#">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
