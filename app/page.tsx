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

      {/* ================= HERO ================= */}
      <Section intensity="high">
        <PageContainer>
          <Motion type="fade" intensity="subtle">
            <div className="min-h-[90vh] flex flex-col items-center justify-center text-center">

              <p className="text-[10px] uppercase tracking-[0.7em] text-white/20 mb-12">
                PRIVATE SYSTEM ACCESS
              </p>

              <h1 className="text-6xl md:text-8xl font-light tracking-[-0.06em] leading-[1.05] text-white/90">
                The Operating System
                <br />
                <span className="text-white/35 italic">
                  for Human Longevity
                </span>
              </h1>

              <div className="mt-12 max-w-2xl">
                <p className="text-white/30 leading-relaxed font-light">
                  Aeonvera is a continuously evolving intelligence layer that models,
                  interprets, and optimizes long-term biological performance.
                </p>
              </div>

              <div className="flex gap-4 mt-14">
                <Button href="/login?mode=signup">
                  Request Access
                </Button>
                <Button href="/platform" variant="secondary">
                  View System
                </Button>
              </div>

            </div>
          </Motion>
        </PageContainer>
      </Section>

      {/* ================= SIGNAL STRIP ================= */}
      <Section intensity="medium">
        <PageContainer>
          <div className="grid md:grid-cols-3 gap-6">

            {[
              {
                title: "Intelligence Engine",
                body: "Continuous biological inference system",
              },
              {
                title: "Digital Model",
                body: "Persistent human health representation",
              },
              {
                title: "Optimization Layer",
                body: "Adaptive long-term performance system",
              },
            ].map((item, i) => (
              <Motion key={i} type="rise" intensity="subtle">
                <Card hover>
                  <div className="py-10 text-center">
                    <div className="text-white/70 tracking-[0.2em] font-light">
                      {item.title}
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.35em] text-white/25 mt-4">
                      {item.body}
                    </div>
                  </div>
                </Card>
              </Motion>
            ))}

          </div>
        </PageContainer>
      </Section>

      {/* ================= CORE SYSTEM ================= */}
      <Section intensity="high">
        <PageContainer>
          <Motion type="fade" intensity="medium">

            <SectionTitle
              eyebrow="System Architecture"
              title="Designed for continuous biological understanding."
              subtitle="A unified layer for tracking, interpreting, and evolving human health intelligence over time."
            />

          </Motion>

          <div className="mt-20 grid md:grid-cols-3 gap-6">

            {[
              {
                title: "Continuous Signal Capture",
                body: "Aggregates biological, behavioral, and environmental data streams.",
              },
              {
                title: "Adaptive Modeling",
                body: "Updates personal health intelligence in real time.",
              },
              {
                title: "Predictive Layer",
                body: "Identifies long-term risk and optimization opportunities.",
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

      {/* ================= PRINCIPLE SECTION ================= */}
      <Section intensity="medium">
        <PageContainer>
          <Motion type="fade" intensity="subtle">

            <div className="grid lg:grid-cols-2 gap-20 items-center">

              <SectionTitle
                eyebrow="Design Principle"
                title="Built as a system, not a product."
                subtitle="Every interaction contributes to a persistent model of human longevity intelligence."
              />

              <div className="space-y-4">
                {[
                  "Signal Ingestion",
                  "Contextual Interpretation",
                  "Adaptive Response",
                ].map((item, i) => (
                  <Motion key={i} type="rise" intensity="subtle">
                    <Card>
                      <div className="text-white/60 font-light tracking-wide">
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

      {/* ================= FINAL CTA ================= */}
      <Section intensity="high">
        <PageContainer>
          <Motion type="scale" intensity="medium">

            <div className="text-center max-w-3xl mx-auto">

              <SectionTitle
                align="center"
                eyebrow="Access"
                title="Begin your intelligence layer."
                subtitle="Initialize your personal biological system and generate your first model."
              />

              <div className="mt-14">
                <Button href="/login?mode=signup">
                  Request System Access
                </Button>
              </div>

            </div>

          </Motion>
        </PageContainer>
      </Section>

    </Page>
  );
}