"use client";

import PageContainer from "@/components/ui/PageContainer";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";

export default function HomePage() {
  return (
    <>
      {/* HERO */}
      <section className="pt-40 pb-36">
        <PageContainer>

          <div className="max-w-6xl mx-auto text-center">

            <p className="text-xs uppercase tracking-[0.5em] text-white/40 mb-10">
              Longevity Intelligence Platform
            </p>

            <h1 className="text-6xl md:text-7xl font-semibold tracking-tight leading-[1.05]">
              The Operating System
              <br />
              For Human Longevity
            </h1>

            <p className="mt-10 text-xl md:text-2xl text-white/60 max-w-3xl mx-auto leading-relaxed">
              Build a living digital model of your biology.
              Analyze risk patterns, track optimization opportunities,
              and generate personalized intelligence through AI.
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-4 mt-14">
              <Button href="/login?mode=signup">
                Begin Assessment
              </Button>

              <Button href="#platform" variant="secondary">
                Explore Platform
              </Button>
            </div>

          </div>

        </PageContainer>
      </section>

      {/* FEATURE STRIP (SYSTEMIZED HEIGHT) */}
      <section className="border-y border-white/10">
        <PageContainer>

          <div className="grid md:grid-cols-3">

            {[
              {
                title: "AI",
                desc: "Intelligence Engine",
              },
              {
                title: "Digital Twin",
                desc: "Persistent Biological Model",
              },
              {
                title: "Longevity",
                desc: "Optimization System",
              },
            ].map((item, i) => (
              <div
                key={i}
                className={`py-10 text-center ${
                  i !== 2 ? "md:border-r border-white/10" : ""
                } border-b md:border-b-0 border-white/10`}
              >
                <div className="text-3xl font-semibold">
                  {item.title}
                </div>

                <div className="text-white/50 text-sm mt-2">
                  {item.desc}
                </div>
              </div>
            ))}

          </div>

        </PageContainer>
      </section>

      {/* PLATFORM */}
      <section id="platform" className="py-32">
        <PageContainer>

          <SectionTitle
            eyebrow="Platform"
            title="A biological intelligence infrastructure."
            description="Every data point contributes to a continuously evolving biological model."
          />

          <div className="grid md:grid-cols-3 gap-8 mt-20">

            <Card label="Biomarkers" title="Biological Monitoring">
              Track biomarkers, sleep, recovery,
              body composition, and health metrics
              in a unified intelligence system.
            </Card>

            <Card label="AI Engine" title="Adaptive Analysis">
              Generate personalized insights,
              detect patterns, and prioritize interventions.
            </Card>

            <Card label="Digital Twin" title="Longitudinal Intelligence">
              Build a persistent biological model
              that improves as data accumulates.
            </Card>

          </div>

        </PageContainer>
      </section>

      {/* SCIENCE */}
      <section className="border-t border-white/10 py-32">
        <PageContainer>

          <div className="grid lg:grid-cols-2 gap-20 items-center">

            <div>
              <SectionTitle
                eyebrow="Scientific Foundation"
                title="Built for long-term biological optimization."
                description="Aeonvera combines AI, longitudinal data, and systems biology modeling."
              />

              <p className="mt-8 text-white/60 leading-relaxed">
                Instead of isolated metrics, the system models
                relationships across biological systems over time.
              </p>
            </div>

            <Card className="p-12">
              <div className="space-y-12">

                {[
                  "Continuous Tracking",
                  "Adaptive Intelligence",
                  "Personalized Protocols",
                ].map((item, i) => (
                  <div key={i}>
                    <div className="text-xs uppercase tracking-[0.35em] text-white/40 mb-3">
                      System Module
                    </div>

                    <h3 className="text-3xl font-semibold">
                      {item}
                    </h3>
                  </div>
                ))}

              </div>
            </Card>

          </div>

        </PageContainer>
      </section>

      {/* CTA */}
      <section className="border-t border-white/10 py-40">
        <PageContainer>

          <div className="max-w-5xl mx-auto text-center">

            <p className="text-xs uppercase tracking-[0.5em] text-white/40 mb-8">
              Begin
            </p>

            <h2 className="text-5xl md:text-6xl font-semibold tracking-tight leading-tight">
              Build Your
              <br />
              Longevity Intelligence Layer
            </h2>

            <p className="mt-8 text-xl text-white/60 max-w-2xl mx-auto">
              Start with your assessment.
              Generate your first AI report.
            </p>

            <div className="mt-12">
              <Button href="/login?mode=signup">
                Access Platform
              </Button>
            </div>

          </div>

        </PageContainer>
      </section>
    </>
  );
}