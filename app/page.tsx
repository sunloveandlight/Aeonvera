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

            <div className="min-h-[90vh] flex flex-col justify-center">

              {/* SYSTEM LABEL */}
              <p className="text-[10px] uppercase tracking-[0.6em] text-white/25 mb-10">
                PRIVATE INTELLIGENCE SYSTEM
              </p>

              {/* MAIN TITLE */}
              <h1 className="text-6xl md:text-8xl font-light tracking-[-0.05em] leading-[1.05] text-white/90">
                Aeonvera
                <br />
                <span className="text-white/40">
                  Biological Intelligence Layer
                </span>
              </h1>

              {/* SUBTEXT */}
              <p className="mt-10 max-w-xl text-white/40 leading-relaxed">
                A continuously evolving system that builds a living model of your health,
                performance, and long-term biological trajectory.
              </p>

              {/* ACTIONS */}
              <div className="flex gap-4 mt-14">
                <Button href="/login?mode=signup">
                  Initialize System
                </Button>

                <Button href="/dashboard" variant="secondary">
                  Enter Command Center
                </Button>
              </div>

            </div>

          </Motion>
        </PageContainer>
      </Section>

      {/* ================= SYSTEM DEFINITION ================= */}
      <Section intensity="medium">
        <PageContainer>

          <SectionTitle
            eyebrow="System Definition"
            title="Not a health app. A biological intelligence operating system."
            subtitle="Every interaction contributes to a persistent model of your physiology and behavior."
          />

          <div className="grid md:grid-cols-3 gap-6 mt-16">

            {[
              {
                title: "Continuous Modeling",
                body: "Your health data is never static — it evolves into a living system.",
              },
              {
                title: "Predictive Intelligence",
                body: "We detect risk patterns before they manifest physically.",
              },
              {
                title: "Adaptive Optimization",
                body: "The system adjusts recommendations based on long-term outcomes.",
              },
            ].map((item, i) => (
              <Card key={i} hover glow>
                <h3 className="text-white/80 font-light text-lg">
                  {item.title}
                </h3>
                <p className="mt-4 text-white/35 text-sm leading-relaxed">
                  {item.body}
                </p>
              </Card>
            ))}

          </div>

        </PageContainer>
      </Section>

      {/* ================= PRODUCT LAYER ================= */}
      <Section intensity="high">
        <PageContainer>

          <SectionTitle
            eyebrow="Platform Layers"
            title="Three integrated intelligence layers."
            subtitle="Each layer builds on the previous one to form a complete biological system."
          />

          <div className="mt-16 grid md:grid-cols-3 gap-6">

            <Card title="LAYER 01 — DATA">
              <p className="text-white/40 text-sm">
                Wearables, labs, biomarkers, lifestyle tracking.
              </p>
            </Card>

            <Card title="LAYER 02 — MODEL">
              <p className="text-white/40 text-sm">
                AI constructs your personal biological simulation.
              </p>
            </Card>

            <Card title="LAYER 03 — INTELLIGENCE">
              <p className="text-white/40 text-sm">
                Predictive recommendations and risk forecasting.
              </p>
            </Card>

          </div>

        </PageContainer>
      </Section>

      {/* ================= FINAL CTA ================= */}
      <Section intensity="high">
        <PageContainer>

          <div className="text-center max-w-3xl mx-auto">

            <SectionTitle
              align="center"
              eyebrow="Access"
              title="Begin your biological intelligence model."
              subtitle="Start your assessment and generate your first system profile."
            />

            <div className="mt-14">
              <Button href="/login?mode=signup">
                Start System Initialization
              </Button>
            </div>

          </div>

        </PageContainer>
      </Section>

    </Page>
  );
}