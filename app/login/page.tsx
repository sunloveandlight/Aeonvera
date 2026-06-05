"use client";

import Link from "next/link";

/* -----------------------------
   Reusable Components
------------------------------*/

function NavItem({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="text-sm text-zinc-400 hover:text-white">
      {children}
    </Link>
  );
}

function Button({
  href,
  variant = "primary",
  children,
}: {
  href: string;
  variant?: "primary" | "secondary";
  children: React.ReactNode;
}) {
  const base =
    "inline-flex items-center justify-center px-8 py-4 rounded-xl text-sm font-medium";

  const styles =
    variant === "primary"
      ? "bg-white text-black"
      : "border border-white/10 bg-white/5 text-white";

  return (
    <Link href={href} className={`${base} ${styles}`}>
      {children}
    </Link>
  );
}

function SectionLabel({
  label,
  title,
}: {
  label: string;
  title: string;
}) {
  return (
    <div>
      <p className="text-xs tracking-[0.35em] text-zinc-500 uppercase mb-4">
        {label}
      </p>
      <h2 className="text-4xl md:text-6xl font-semibold tracking-tight leading-tight">
        {title}
      </h2>
    </div>
  );
}

function Card({
  tag,
  title,
  children,
}: {
  tag: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-white/10 bg-zinc-950 p-8 rounded-2xl">
      <p className="text-xs tracking-[0.3em] text-zinc-500 uppercase mb-4">
        {tag}
      </p>
      <h3 className="text-xl font-semibold mb-4">{title}</h3>
      <p className="text-zinc-400 leading-relaxed text-sm">{children}</p>
    </div>
  );
}

/* -----------------------------
   Page
------------------------------*/

export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-white">

      {/* BACKGROUND (STATIC ONLY) */}
      <div className="fixed inset-0 -z-10 bg-black">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_45%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(255,255,255,0.02))]" />
      </div>

      {/* NAV */}
      <header className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="tracking-[0.25em] text-lg font-semibold">
            AEONVERA
          </div>

          <nav className="hidden md:flex gap-10">
            <a href="#platform" className="text-sm text-zinc-400">
              Platform
            </a>
            <a href="#science" className="text-sm text-zinc-400">
              Science
            </a>
            <NavItem href="/pricing">Pricing</NavItem>
          </nav>

          <div className="flex gap-4">
            <NavItem href="/login?mode=signin">Sign In</NavItem>
            <Button href="/login?mode=signup">Begin</Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="px-6 pt-32 pb-28">
        <div className="max-w-5xl mx-auto text-center">

          <p className="text-xs tracking-[0.4em] text-zinc-500 uppercase mb-10">
            AI-NATIVE LONGEVITY SYSTEM
          </p>

          <h1 className="text-5xl md:text-7xl font-semibold leading-[1.05] tracking-tight">
            Intelligence for extending human lifespan.
          </h1>

          <p className="mt-10 text-lg md:text-xl text-zinc-400 leading-relaxed max-w-3xl mx-auto">
            Aeonvera is a computational platform for biological optimization —
            unifying AI, health data, and longevity science into a single system.
          </p>

          <div className="mt-14 flex flex-col sm:flex-row justify-center gap-4">
            <Button href="/login?mode=signup">Access Platform</Button>
            <Button href="#platform" variant="secondary">
              Explore System
            </Button>
          </div>
        </div>
      </section>

      {/* PLATFORM */}
      <section id="platform" className="px-6 py-28 border-t border-white/10">
        <div className="max-w-7xl mx-auto">

          <SectionLabel
            label="Platform"
            title="A biological intelligence operating system"
          />

          <div className="grid md:grid-cols-3 gap-8 mt-20">
            <Card tag="BIOMARKERS" title="Biological Monitoring">
              Unified health data architecture combining bloodwork,
              biomarkers, sleep, recovery, and metabolic signals into one
              intelligence layer.
            </Card>

            <Card tag="AI SYSTEMS" title="Longevity Intelligence">
              AI-driven optimization models for cognition, metabolism, sleep,
              and lifespan extension strategies.
            </Card>

            <Card tag="INFRASTRUCTURE" title="Adaptive Health Layer">
              A persistent system that evolves with user biology over time,
              refining recommendations continuously.
            </Card>
          </div>

        </div>
      </section>

      {/* SCIENCE */}
      <section id="science" className="px-6 py-28 border-t border-white/10">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-20">

          <div>
            <SectionLabel
              label="Scientific Foundation"
              title="Computational longevity infrastructure"
            />

            <p className="mt-10 text-zinc-400 leading-relaxed">
              Aeonvera integrates artificial intelligence with longitudinal
              biological datasets to model human health trajectories and
              intervention strategies.
            </p>

            <p className="mt-6 text-zinc-400 leading-relaxed">
              The system is designed as a foundational layer for predictive
              medicine, preventative health, and biological age optimization.
            </p>
          </div>

          <div className="border border-white/10 bg-zinc-950 p-10 rounded-2xl space-y-10">

            <div>
              <p className="text-xs tracking-[0.3em] text-zinc-500 mb-2">
                LONGITUDINAL DATA
              </p>
              <p className="text-2xl font-semibold">
                Continuous biological tracking
              </p>
            </div>

            <div>
              <p className="text-xs tracking-[0.3em] text-zinc-500 mb-2">
                AI REASONING
              </p>
              <p className="text-2xl font-semibold">
                Adaptive health intelligence
              </p>
            </div>

            <div>
              <p className="text-xs tracking-[0.3em] text-zinc-500 mb-2">
                OPTIMIZATION ENGINE
              </p>
              <p className="text-2xl font-semibold">
                Personalized longevity protocols
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-32 border-t border-white/10">
        <div className="max-w-4xl mx-auto text-center">

          <SectionLabel
            label="Begin"
            title="Build your longevity intelligence layer"
          />

          <p className="mt-8 text-zinc-400 text-lg">
            Access AI-powered biological optimization infrastructure.
          </p>

          <div className="mt-12">
            <Button href="/login?mode=signup">
              Access Platform
            </Button>
          </div>

        </div>
      </section>

    </main>
  );
}