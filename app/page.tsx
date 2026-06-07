"use client";

import Page from "@/components/ui/Page";
import PageContainer from "@/components/ui/PageContainer";
import Section from "@/components/ui/Section";
import SectionTitle from "@/components/ui/SectionTitle";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Motion from "@/components/motion/Motion";

export default function HomePage() {
  return (
    <Page density="spacious">
      {/* ================================
          HERO (NO HEAVY MOTION — CONTROLLED PRESENCE)
      ================================= */}
      <Section intensity="high">
        <PageContainer>
          <Motion type="fade" intensity="subtle">
            <div className="min-h-[85vh] flex flex-col items-center justify-center text-center">
              
              <p className="text-[10px] uppercase tracking-[0.6em] text-white/25 mb-10">
                Private Longevity Intelligence
              </p>

              <h1 className="text-6xl md:text-8xl font-light tracking-[-0.04em] leading-[1.02] text-white/90">
                The Operating System
                <br />
                <span className="text-white/40 italic">for Human Longevity</span>
              </h1>

              <p className="mt-10 text-white/35 max-w-xl leading-relaxed font-light">
                A continuously evolving biological intelligence layer built for long-term optimization.
              </p>

              <div className="flex gap-4 mt-14">
                <Button href="/login?mode=signup">
                  Begin Assessment
                </Button>
                <Button href="/platform" variant="secondary">
                  Explore Platform
                </Button>
              </div>
            </div>
          </Motion>
        </PageContainer>
      </Section>

      {/* ================================
          SYSTEM STATS (CONTROLLED REVEAL)
      ================================= */}
      <Section intensity="medium">
        <PageContainer>
          <Motion type="rise" intensity="subtle">
            <div className="grid md:grid-cols-3 gap-px bg-white/[0.06]">
              {[
                { value: "AI", label: "Intelligence Engine" },
                { value: "Digital Twin", label: "Biological Model" },
                { value: "Longevity", label: "Optimization System" },
              ].map((item, i) => (
                <Card key={i} hover>
                  <div className="text-center py-10">
                    <div className="text-2xl font-light text-white/80 tracking-[0.15em]">
                      {item.value}
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.4em] text-white/25 mt-3">
                      {item.label}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Motion>
        </PageContainer>
      </Section>

      {/* ================================
          PLATFORM (STRUCTURED REVEAL)
      ================================= */}
      <Section intensity="high">
        <PageContainer>
          <Motion type="fade" intensity="medium">
            <SectionTitle
              eyebrow="Platform"
              title="A biological intelligence infrastructure."
              subtitle="Every data point contributes to a continuously evolving model of human health and performance."
            />
          </Motion>

          <div className="mt-20 grid md:grid-cols-3 gap-6">
            {[
              {
                title: "Biological Monitoring",
                body: "Track biomarkers, sleep, recovery, and health metrics in a unified system.",
              },
              {
                title: "Adaptive Intelligence",
                body: "Generate personalized insights and detect risk patterns automatically.",
              },
              {
                title: "Digital Twin",
                body: "Build a persistent biological model that improves with time.",
              },
            ].map((item, i) => (
              <Motion key={i} type="rise" intensity="subtle">
                <Card hover glow>
                  <h3 className="text-white/80 font-light text-lg">
                    {item.title}
                  </h3>
                  <p className="mt-4 text-white/30 text-sm leading-relaxed">
                    {item.body}
                  </p>
                </Card>
              </Motion>
            ))}
          </div>
        </PageContainer>
      </Section>

      {/* ================================
          SCIENCE (SLOW REVEAL LAYER)
      ================================= */}
      <Section intensity="medium">
        <PageContainer>
          <Motion type="fade" intensity="subtle">
            <div className="grid lg:grid-cols-2 gap-20 items-center">
              
              <SectionTitle
                eyebrow="Scientific Foundation"
                title="Built for long-term biological optimization."
                subtitle="Systems biology, AI modeling, and longitudinal data convergence."
              />

              <div className="space-y-4">
                {[
                  "Continuous Tracking",
                  "Adaptive Intelligence",
                  "Personalized Protocols",
                ].map((item, i) => (
                  <Motion key={i} type="rise" intensity="subtle">
                    <Card>
                      <div className="text-white/70 font-light">
                        {String(i + 1).padStart(2, "0")} — {item}
                      </div>
                    </Card>
                  </Motion>
                ))}
              </div>
            </div>
          </Motion>
        </PageContainer>
      </Section>

      {/* ================================
          CTA (HIGH INTENSITY FOCUS MOMENT)
      ================================= */}
      <Section intensity="high">
        <PageContainer>
          <Motion type="scale" intensity="medium">
            <div className="text-center max-w-3xl mx-auto">
              <SectionTitle
                align="center"
                eyebrow="Begin"
                title="Build your longevity intelligence layer."
                subtitle="Start your assessment and generate your first biological model."
              />

              <div className="mt-14">
                <Button href="/login?mode=signup">
                  Access Platform
                </Button>
              </div>
            </div>
          </Motion>
        </PageContainer>
      </Section>
    </Page>
  );
}