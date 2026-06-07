"use client";

import PageContainer from "@/components/ui/PageContainer";
import Button from "@/components/ui/Button";

export default function HomePage() {
  return (
    <div className="flex flex-col">

      {/* HERO */}
      <section className="min-h-[92vh] flex flex-col items-center justify-center text-center px-6 pt-32 pb-24">
        <p className="text-[10px] uppercase tracking-[0.6em] text-white/25 mb-12">
          Private Longevity Intelligence
        </p>

        <h1 className="text-6xl md:text-8xl font-light tracking-[-0.04em] leading-[1.02] max-w-5xl text-white/95">
          The Operating System
          <br />
          <span className="italic text-white/50">for Human Longevity</span>
        </h1>

        <p className="mt-10 text-lg text-white/35 max-w-xl mx-auto leading-relaxed font-light tracking-wide">
          A continuously evolving biological intelligence layer.
          Built for those who take their future seriously.
        </p>

        <div className="flex flex-col sm:flex-row justify-center gap-4 mt-16">
          <Button href="/login?mode=signup">
            Begin Assessment
          </Button>
          <Button href="#platform" variant="secondary">
            Explore Platform
          </Button>
        </div>

        {/* subtle divider */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 opacity-20">
          <div className="w-px h-12 bg-white/40" />
        </div>
      </section>

      {/* STAT STRIP */}
      <section className="border-t border-b border-white/[0.06] py-0">
        <PageContainer>
          <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/[0.06]">
            {[
              { value: "AI", label: "Intelligence Engine" },
              { value: "Digital Twin", label: "Persistent Biological Model" },
              { value: "Longevity", label: "Optimization System" },
            ].map((item, i) => (
              <div key={i} className="py-14 text-center">
                <div className="text-2xl font-light tracking-[0.15em] text-white/80">
                  {item.value}
                </div>
                <div className="text-[11px] uppercase tracking-[0.4em] text-white/25 mt-3">
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </PageContainer>
      </section>

      {/* PLATFORM */}
      <section id="platform" className="py-40">
        <PageContainer>

          <div className="max-w-xl mb-24">
            <p className="text-[10px] uppercase tracking-[0.6em] text-white/25 mb-6">
              Platform
            </p>
            <h2 className="text-4xl md:text-5xl font-light tracking-[-0.03em] leading-[1.1] text-white/90">
              A biological intelligence infrastructure.
            </h2>
            <p className="mt-6 text-white/35 leading-relaxed font-light">
              Every data point contributes to a continuously evolving biological model.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-px bg-white/[0.06]">
            {[
              {
                label: "Biomarkers",
                title: "Biological Monitoring",
                body: "Track biomarkers, sleep, recovery, body composition, and health metrics in a unified intelligence system.",
              },
              {
                label: "AI Engine",
                title: "Adaptive Analysis",
                body: "Generate personalized insights, detect risk patterns, and prioritize interventions automatically.",
              },
              {
                label: "Digital Twin",
                title: "Longitudinal Intelligence",
                body: "Build a persistent biological model that deepens as data accumulates over time.",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="bg-[#05060a] p-12 flex flex-col gap-8 hover:bg-white/[0.02] transition-colors duration-500"
              >
                <p className="text-[10px] uppercase tracking-[0.5em] text-white/20">
                  {item.label}
                </p>
                <h3 className="text-xl font-light text-white/80 tracking-tight">
                  {item.title}
                </h3>
                <p className="text-sm text-white/30 leading-relaxed font-light">
                  {item.body}
                </p>
              </div>
            ))}
          </div>

        </PageContainer>
      </section>

      {/* SCIENCE */}
      <section className="py-40 border-t border-white/[0.06]">
        <PageContainer>
          <div className="grid lg:grid-cols-2 gap-24 items-center">

            <div>
              <p className="text-[10px] uppercase tracking-[0.6em] text-white/25 mb-6">
                Scientific Foundation
              </p>
              <h2 className="text-4xl md:text-5xl font-light tracking-[-0.03em] leading-[1.1] text-white/90">
                Built for long-term biological optimization.
              </h2>
              <p className="mt-8 text-white/35 leading-relaxed font-light">
                Aeonvera combines AI, longitudinal data, and systems biology modeling. Instead of isolated metrics, the system models relationships across biological systems over time.
              </p>
            </div>

            <div className="flex flex-col divide-y divide-white/[0.06] border border-white/[0.06]">
              {[
                { num: "01", title: "Continuous Tracking" },
                { num: "02", title: "Adaptive Intelligence" },
                { num: "03", title: "Personalized Protocols" },
              ].map((item) => (
                <div key={item.num} className="flex items-center gap-8 px-10 py-10 hover:bg-white/[0.02] transition-colors duration-500">
                  <span className="text-[11px] text-white/15 font-light tracking-widest">
                    {item.num}
                  </span>
                  <h3 className="text-xl font-light text-white/70 tracking-tight">
                    {item.title}
                  </h3>
                </div>
              ))}
            </div>

          </div>
        </PageContainer>
      </section>

      {/* MEMBERSHIP */}
      <section className="py-40 border-t border-white/[0.06]">
        <PageContainer>
          <div className="grid lg:grid-cols-2 gap-24 items-center">

            <div>
              <p className="text-[10px] uppercase tracking-[0.6em] text-white/25 mb-6">
                Membership
              </p>
              <h2 className="text-4xl md:text-5xl font-light tracking-[-0.03em] leading-[1.1] text-white/90">
                Three tiers of longevity intelligence.
              </h2>
              <p className="mt-8 text-white/35 leading-relaxed font-light">
                From foundational tracking to a fully personalized longevity operating system with dedicated support and unlimited AI analysis.
              </p>
              <div className="mt-12">
                <Button href="/pricing" variant="secondary">
                  View Membership
                </Button>
              </div>
            </div>

            <div className="flex flex-col divide-y divide-white/[0.06] border border-white/[0.06]">
              {[
                { name: "Core", price: "$49", desc: "Foundational longevity tracking" },
                { name: "Elite", price: "$199", desc: "Full AI-powered optimization" },
                { name: "Sovereign", price: "$999", desc: "Private longevity intelligence" },
              ].map((item) => (
                <div key={item.name} className="flex items-center justify-between px-10 py-8 hover:bg-white/[0.02] transition-colors duration-500">
                  <div>
                    <p className="text-white/70 font-light">{item.name}</p>
                    <p className="text-[11px] text-white/25 mt-1 tracking-wide">{item.desc}</p>
                  </div>
                  <p className="text-white/40 font-light text-lg">{item.price}</p>
                </div>
              ))}
            </div>

          </div>
        </PageContainer>
      </section>

      {/* CTA */}
      <section className="py-48 border-t border-white/[0.06] text-center">
        <PageContainer>
          <div className="max-w-3xl mx-auto">
            <p className="text-[10px] uppercase tracking-[0.6em] text-white/20 mb-10">
              Begin
            </p>
            <h2 className="text-5xl md:text-7xl font-light tracking-[-0.04em] leading-[1.02] text-white/90">
              Build your longevity
              <br />
              <span className="italic text-white/40">intelligence layer.</span>
            </h2>
            <p className="mt-10 text-white/30 font-light max-w-md mx-auto leading-relaxed">
              Start with your assessment. Generate your first AI report. Begin optimizing.
            </p>
            <div className="mt-14">
              <Button href="/login?mode=signup">
                Access Platform
              </Button>
            </div>
          </div>
        </PageContainer>
      </section>

    </div>
  );
}