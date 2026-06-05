"use client";

import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import PageContainer from "@/components/ui/PageContainer";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";

export default function HomePage() {
  return (
    <AppShell>

      {/* HERO */}
      <section className="pt-32 pb-28">
        <PageContainer>

          <div className="max-w-5xl mx-auto text-center">

            <p className="text-xs uppercase tracking-[0.45em] text-white/40 mb-8">
              Longevity Intelligence Platform
            </p>

            <h1 className="text-6xl md:text-8xl font-semibold tracking-tight leading-[0.95]">
              Extend Human
              <br />
              Lifespan Through
              <br />
              Intelligence.
            </h1>

            <p className="mt-10 text-xl text-white/60 max-w-3xl mx-auto leading-relaxed">
              Aeonvera is building the operating system for human longevity,
              integrating artificial intelligence, biological data,
              optimization protocols, and predictive health intelligence
              into a unified platform.
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-4 mt-12">
              <Button href="/login?mode=signup">
                Access Platform
              </Button>

              <Button
                href="#platform"
                variant="secondary"
              >
                Explore Platform
              </Button>
            </div>
          </div>

        </PageContainer>
      </section>

      {/* PLATFORM */}
      <section
        id="platform"
        className="py-28 border-t border-white/10"
      >
        <PageContainer>

          <SectionTitle
            eyebrow="Platform"
            title="A biological intelligence operating system."
            description="Unified infrastructure for health data, longevity optimization, and AI-driven biological intelligence."
          />

          <div className="grid md:grid-cols-3 gap-8 mt-20">

            <Card
              label="Biomarkers"
              title="Biological Monitoring"
            >
              Centralize bloodwork, biomarker trends,
              recovery metrics, sleep data, and health signals
              into a continuously evolving intelligence profile.
            </Card>

            <Card
              label="AI Systems"
              title="Longevity Intelligence"
            >
              Generate adaptive optimization strategies
              focused on lifespan, cognitive performance,
              metabolic resilience, and recovery.
            </Card>

            <Card
              label="Infrastructure"
              title="Digital Twin"
            >
              Build a persistent biological model that
              continuously evolves as new data is collected
              and analyzed.
            </Card>

          </div>

        </PageContainer>
      </section>

      {/* SCIENCE */}
      <section className="py-28 border-t border-white/10">
        <PageContainer>

          <div className="grid lg:grid-cols-2 gap-16 items-center">

            <div>

              <SectionTitle
                eyebrow="Scientific Foundation"
                title="Computational longevity at scale."
                description="A new approach to lifespan optimization powered by artificial intelligence and longitudinal biological data."
              />

              <p className="mt-8 text-white/60 leading-relaxed">
                Aeonvera integrates AI reasoning systems,
                biomarker analysis, behavioral modeling,
                and predictive health intelligence into a
                unified platform capable of adapting over time.
              </p>

              <p className="mt-6 text-white/60 leading-relaxed">
                The result is a continuously evolving
                biological operating system designed to
                improve long-term health outcomes.
              </p>

            </div>

            <Card className="p-12">

              <div className="space-y-10">

                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-white/40 mb-3">
                    System Module
                  </p>

                  <h3 className="text-3xl font-semibold">
                    Continuous Biological Tracking
                  </h3>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-white/40 mb-3">
                    System Module
                  </p>

                  <h3 className="text-3xl font-semibold">
                    Adaptive Health Intelligence
                  </h3>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-white/40 mb-3">
                    System Module
                  </p>

                  <h3 className="text-3xl font-semibold">
                    Personalized Longevity Protocols
                  </h3>
                </div>

              </div>

            </Card>

          </div>

        </PageContainer>
      </section>

      {/* CTA */}
      <section className="py-32 border-t border-white/10">

        <PageContainer>

          <div className="max-w-4xl mx-auto text-center">

            <p className="text-xs uppercase tracking-[0.45em] text-white/40 mb-6">
              Begin
            </p>

            <h2 className="text-5xl md:text-7xl font-semibold tracking-tight">
              Build Your
              <br />
              Longevity Intelligence Layer.
            </h2>

            <p className="mt-8 text-white/60 text-xl">
              Access the next generation of AI-powered
              biological optimization.
            </p>

            <div className="mt-12">
              <Button href="/login?mode=signup">
                Access Platform
              </Button>
            </div>

          </div>

        </PageContainer>

      </section>

    </AppShell>
  );
}