"use client";

import Link from "next/link";

/* -----------------------------
   Reusable UI Components
------------------------------*/

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-sm text-zinc-400 hover:text-white transition"
    >
      {children}
    </Link>
  );
}

function CTAButton({
  href,
  variant = "primary",
  children,
}: {
  href: string;
  variant?: "primary" | "secondary";
  children: React.ReactNode;
}) {
  const base =
    "inline-flex items-center justify-center px-8 py-4 rounded-2xl font-semibold transition";

  const styles =
    variant === "primary"
      ? "bg-white text-black hover:bg-zinc-200"
      : "border border-white/10 bg-white/5 hover:bg-white/10 text-white";

  return (
    <Link href={href} className={`${base} ${styles}`}>
      {children}
    </Link>
  );
}

function SectionHeading({
  eyebrow,
  title,
  center = false,
}: {
  eyebrow: string;
  title: string;
  center?: boolean;
}) {
  return (
    <div className={center ? "text-center" : ""}>
      <p className="uppercase tracking-[0.35em] text-zinc-500 text-sm mb-6">
        {eyebrow}
      </p>
      <h2 className="text-4xl md:text-6xl font-bold leading-tight">
        {title}
      </h2>
    </div>
  );
}

function FeatureCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8 hover:bg-white/[0.05] transition">
      <div className="text-xs uppercase tracking-[0.25em] text-zinc-500 mb-4">
        {subtitle}
      </div>
      <h3 className="text-2xl font-semibold mb-4">{title}</h3>
      <p className="text-zinc-400 leading-relaxed">{children}</p>
    </div>
  );
}

/* -----------------------------
   Page
------------------------------*/

export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-white overflow-hidden relative">

      {/* Background Layer */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-black" />

        {/* soft radial glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.10),transparent_40%)]" />

        {/* subtle vertical depth */}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(255,255,255,0.04))]" />

        {/* noise overlay (static texture feel) */}
        <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
      </div>

      {/* NAV */}
      <header className="border-b border-white/10 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="text-xl font-semibold tracking-[0.25em]">
            AEONVERA
          </div>

          <nav className="hidden md:flex items-center gap-10">
            <a href="#platform" className="text-sm text-zinc-400 hover:text-white transition">
              Platform
            </a>
            <a href="#science" className="text-sm text-zinc-400 hover:text-white transition">
              Science
            </a>
            <NavLink href="/pricing">Pricing</NavLink>
          </nav>

          <div className="flex items-center gap-4">
            <NavLink href="/login?mode=signin">Sign In</NavLink>
            <CTAButton href="/login?mode=signup">Begin</CTAButton>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="px-6 pt-32 pb-28">
        <div className="max-w-6xl mx-auto text-center">
          <p className="uppercase tracking-[0.4em] text-zinc-500 text-sm mb-8">
            AI-NATIVE LONGEVITY INTELLIGENCE
          </p>

          <h1 className="text-5xl md:text-8xl font-bold leading-[0.95] tracking-tight">
            Extend human lifespan through intelligence.
          </h1>

          <p className="mt-10 text-lg md:text-2xl text-zinc-400 max-w-3xl mx-auto leading-relaxed">
            Aeonvera builds the intelligence infrastructure for human longevity —
            integrating AI systems, biological data, and computational medicine
            into one adaptive platform.
          </p>

          <div className="mt-14 flex flex-col sm:flex-row gap-5 justify-center">
            <CTAButton href="/login?mode=signup">Access Platform</CTAButton>
            <CTAButton href="#platform" variant="secondary">
              Explore Platform
            </CTAButton>
          </div>
        </div>
      </section>

      {/* PLATFORM */}
      <section id="platform" className="px-6 py-28 border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <SectionHeading
            eyebrow="Platform"
            title="A biological intelligence operating system."
          />

          <div className="grid md:grid-cols-3 gap-8 mt-20">
            <FeatureCard
              title="Biological Monitoring"
              subtitle="BIOMARKERS"
            >
              Centralize bloodwork, biomarkers, recovery metrics, and health
              data into a continuously evolving intelligence profile.
            </FeatureCard>

            <FeatureCard
              title="Longevity Intelligence"
              subtitle="AI SYSTEMS"
            >
              AI-generated optimization protocols across cognition, recovery,
              metabolism, sleep, and lifespan extension.
            </FeatureCard>

            <FeatureCard
              title="Human Optimization Layer"
              subtitle="INFRASTRUCTURE"
            >
              A dynamic intelligence system that adapts to biological changes
              over time.
            </FeatureCard>
          </div>
        </div>
      </section>

      {/* SCIENCE */}
      <section id="science" className="px-6 py-28 border-t border-white/10">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-20 items-center">

          <div>
            <SectionHeading
              eyebrow="Scientific Foundation"
              title="Computational longevity at scale."
            />

            <p className="text-zinc-400 text-lg leading-relaxed mt-10 mb-6">
              Aeonvera combines artificial intelligence, longitudinal health
              data, and optimization systems to create adaptive longevity
              intelligence.
            </p>

            <p className="text-zinc-400 text-lg leading-relaxed">
              The platform evolves into a unified infrastructure layer for
              preventive health, cognitive optimization, and biological age
              intervention systems.
            </p>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] backdrop-blur-xl p-10 space-y-10">
            <div>
              <div className="text-zinc-500 text-sm mb-2">
                LONGITUDINAL DATA
              </div>
              <div className="text-3xl font-semibold">
                Continuous Biological Tracking
              </div>
            </div>

            <div>
              <div className="text-zinc-500 text-sm mb-2">
                AI REASONING
              </div>
              <div className="text-3xl font-semibold">
                Adaptive Health Intelligence
              </div>
            </div>

            <div>
              <div className="text-zinc-500 text-sm mb-2">
                OPTIMIZATION ENGINE
              </div>
              <div className="text-3xl font-semibold">
                Personalized Longevity Protocols
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-36 border-t border-white/10">
        <div className="max-w-5xl mx-auto text-center">
          <SectionHeading
            eyebrow="Begin"
            title="Build your longevity intelligence layer."
            center
          />

          <p className="mt-8 text-zinc-400 text-xl max-w-2xl mx-auto leading-relaxed">
            Access the next generation of AI-powered biological optimization.
          </p>

          <div className="mt-12">
            <CTAButton href="/login?mode=signup">
              Access Platform
            </CTAButton>
          </div>
        </div>
      </section>
    </main>
  );
}