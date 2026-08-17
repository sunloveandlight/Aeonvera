import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  FileText,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
  Stethoscope,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import PageContainer from "@/components/ui/PageContainer";
import DemoExperienceClient from "./DemoExperienceClient";

export const metadata: Metadata = {
  title: "Demo Workspace",
  description:
    "Preview Aeonvera with sample longevity signals, protocols, and physician-sharing workflows before connecting real data.",
  alternates: {
    canonical: "/demo",
  },
  openGraph: {
    title: "Aeonvera Demo Workspace",
    description:
      "See how Aeonvera turns labs, wearables, and daily execution into private longevity intelligence.",
    url: "/demo",
    images: [
      {
        url: "/marketing/rejuvenation-woman.png",
        width: 1536,
        height: 1024,
        alt: "Aeonvera demo workspace.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aeonvera Demo Workspace",
    description:
      "See how Aeonvera turns labs, wearables, and daily execution into private longevity intelligence.",
    images: ["/marketing/rejuvenation-woman.png"],
  },
};

const snapshot = [
  {
    label: "Biological age",
    value: "37.8",
    detail: "1.9 years above chronological age",
    tone: "watch",
  },
  {
    label: "Recovery",
    value: "74%",
    detail: "Sleep improved, HRV still below target",
    tone: "improving",
  },
  {
    label: "Metabolic risk",
    value: "Moderate",
    detail: "HbA1c and triglycerides need follow-up",
    tone: "watch",
  },
  {
    label: "Execution",
    value: "68%",
    detail: "Strength is consistent; Zone 2 is not",
    tone: "neutral",
  },
];

const valuePillars = [
  {
    icon: LockKeyhole,
    title: "It remembers the whole health story.",
    body: "Labs, wearables, symptoms, goals, protocols, outcomes, and clinician questions live in one private timeline instead of scattered notes and screenshots.",
  },
  {
    icon: TrendingUp,
    title: "It explains what changed.",
    body: "Aeonvera compares new signals against your baseline so you see direction, tradeoffs, and possible causes rather than isolated numbers.",
  },
  {
    icon: ClipboardList,
    title: "It decides what deserves attention now.",
    body: "The system narrows a messy longevity universe into a few high-leverage priorities, what to ignore, and what needs outside review.",
  },
  {
    icon: CalendarCheck,
    title: "It turns insight into execution.",
    body: "Weekly protocols, reminders, check-ins, and adjustment loops make the plan survive real life.",
  },
  {
    icon: Stethoscope,
    title: "It prepares better clinician conversations.",
    body: "Aeonvera turns your history into concise summaries, questions, and risk flags a professional can review faster.",
  },
  {
    icon: Activity,
    title: "It compares plan against reality.",
    body: "A normal AI gives advice once. Aeonvera checks whether the protocol actually moved the metrics it was supposed to move.",
  },
];

const personalBrief = [
  {
    label: "Highest leverage",
    title: "Improve metabolic resilience before adding advanced interventions.",
    body: "ApoB is acceptable, but HbA1c, fasting glucose, and triglycerides point to a better first move: sleep consistency, post-meal walks, and Zone 2 adherence.",
  },
  {
    label: "Do not chase yet",
    title: "Defer supplement complexity until recovery stabilizes.",
    body: "The model sees more upside in sleep timing and aerobic base than adding new supplements this week.",
  },
  {
    label: "Clinician review",
    title: "Ask about glucose trend, lipids, and family history together.",
    body: "Aeonvera prepares a short packet so the appointment starts with the pattern, not a pile of disconnected results.",
  },
];

const weeklyPlan = [
  {
    day: "Mon",
    task: "Zone 2, 42 minutes",
    why: "Lowest-friction lever for glucose control and recovery capacity.",
  },
  {
    day: "Tue",
    task: "Sleep anchor: lights out 10:30 PM",
    why: "Last week's HRV drop followed two late nights.",
  },
  {
    day: "Wed",
    task: "Strength session, lower volume",
    why: "Keep muscle stimulus without burying recovery.",
  },
  {
    day: "Fri",
    task: "Post-meal walk after dinner",
    why: "Targets glucose without adding another complex protocol.",
  },
];

const realityLoop = [
  { metric: "Sleep duration", before: "6h 28m", after: "7h 12m", result: "Improved", icon: TrendingUp },
  { metric: "Resting HR", before: "63 bpm", after: "59 bpm", result: "Improved", icon: TrendingDown },
  { metric: "Zone 2 adherence", before: "1/wk", after: "2/wk", result: "On track", icon: CheckCircle2 },
  { metric: "Fasting glucose", before: "101", after: "98", result: "Watch", icon: Activity },
];

const clinicianPacket = [
  "Timeline of recent labs, wearable changes, and protocols",
  "Top 3 questions for the appointment",
  "Risk flags that need licensed professional review",
  "What changed since the last assessment",
];

const comparison = [
  {
    free: "Read articles and remember what applies to you.",
    aeonvera: "Keeps your personal timeline and applies guidance to your actual history.",
  },
  {
    free: "Ask a generic AI every time from scratch.",
    aeonvera: "Answers from your labs, wearables, goals, protocols, and prior outcomes.",
  },
  {
    free: "Track habits in separate apps.",
    aeonvera: "Connects execution to biological age, biomarkers, recovery, and clinician context.",
  },
  {
    free: "Bring your doctor a long list of screenshots.",
    aeonvera: "Creates a concise, shareable clinical packet with priorities and questions.",
  },
];

export default function DemoPage() {
  return (
    <div className="aeon-demo-page min-h-screen bg-[#050506] text-white">
      <section className="aeon-demo-hero relative overflow-hidden pt-24 pb-14 md:pt-32">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(circle_at_50%_0%,rgba(214,187,114,0.18),transparent_34rem)]" />
        <PageContainer>
          <div className="relative mx-auto max-w-4xl text-center">
            <p className="micro-label">Demo profile</p>
            <h1 className="mt-5 text-5xl font-semibold leading-[0.98] tracking-tight md:text-7xl">
              See why this is worth paying for.
            </h1>
            <p className="aeon-demo-hero-copy mx-auto mt-6 max-w-2xl text-lg leading-8">
              This sample profile shows the value Aeonvera has to create:
              remembering your health story, explaining what changed, choosing
              what matters now, and turning it into a plan you can actually use.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/login?mode=signup" className="premium-action px-5 py-3 text-sm">
                Start with my data
              </Link>
              <Link href="/pricing" className="premium-action-secondary rounded-md px-5 py-3 text-sm">
                Compare plans
              </Link>
            </div>
          </div>
        </PageContainer>
      </section>

      <section className="pb-10">
        <PageContainer>
          <div className="mb-4">
            <DemoExperienceClient />
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="executive-panel rounded-lg p-6 md:p-8">
              <div className="flex items-center justify-between gap-4">
                <p className="micro-label">Sample signal map</p>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1 text-xs font-semibold text-white/58">
                  <ShieldCheck size={14} /> Private demo data
                </span>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {snapshot.map((signal) => (
                  <div key={signal.label} className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-4">
                    <p className="text-xs uppercase tracking-[0.12em] text-white/38">{signal.label}</p>
                    <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{signal.value}</p>
                    <p className="mt-3 text-sm leading-6 text-white/52">{signal.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="executive-panel rounded-lg p-6 md:p-8">
              <p className="micro-label">Personal health brief</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white">
                One useful answer, not a pile of charts.
              </h2>
              <div className="mt-6 space-y-3">
                {personalBrief.map((item) => (
                  <div key={item.label} className="rounded-lg border border-[rgba(var(--gold),0.18)] bg-[rgba(var(--gold),0.045)] p-4">
                    <p className="av-eyebrow text-[rgba(var(--gold),0.78)]">{item.label}</p>
                    <h3 className="mt-2 text-base font-semibold text-white">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/62">{item.body}</p>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-sm leading-6 text-white/42">
                Real accounts replace this sample data with your assessment,
                lab imports, wearable sync, memory, reports, and secure share
                links.
              </p>
            </div>
          </div>
        </PageContainer>
      </section>

      <section className="py-12">
        <PageContainer>
          <div className="mx-auto max-w-3xl text-center">
            <p className="micro-label">Where the value comes from</p>
            <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-white md:text-6xl">
              Aeonvera earns the subscription by doing the synthesis work.
            </h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {valuePillars.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div key={pillar.title} className="executive-panel rounded-lg p-6">
                  <div className="grid h-11 w-11 place-items-center rounded-full border border-[rgba(var(--gold),0.22)] bg-[rgba(var(--gold),0.08)] text-[rgb(var(--gold))]">
                    <Icon size={20} />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold tracking-tight text-white">
                    {pillar.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-white/58">{pillar.body}</p>
                </div>
              );
            })}
          </div>
        </PageContainer>
      </section>

      <section className="py-12">
        <PageContainer>
          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="executive-panel rounded-lg p-6 md:p-8">
              <p className="micro-label">Weekly longevity plan</p>
              <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-white">
                The plan has to land in real life.
              </h2>
              <p className="mt-4 text-base leading-7 text-white/58">
                Aeonvera should not just explain health. It should turn the
                explanation into a week that is specific, trackable, and light
                enough to execute.
              </p>
              <Link href="/life-autopilot" className="premium-action-secondary mt-7 inline-flex rounded-md px-5 py-3 text-sm">
                Preview planning system
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {weeklyPlan.map((item) => (
                <div key={item.day} className="rounded-lg border border-white/[0.08] bg-white/[0.035] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-white/[0.08] px-3 py-1 text-xs font-bold text-white/72">
                      {item.day}
                    </span>
                    <CalendarCheck size={18} className="text-[rgb(var(--gold))]" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-white">{item.task}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/56">{item.why}</p>
                </div>
              ))}
            </div>
          </div>
        </PageContainer>
      </section>

      <section className="py-12">
        <PageContainer>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="executive-panel rounded-lg p-6 md:p-8">
              <p className="micro-label">Plan versus reality</p>
              <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-white">
                Advice is cheap. Feedback loops are valuable.
              </h2>
              <p className="mt-4 text-base leading-7 text-white/58">
                The product becomes hard to replace when it remembers what you
                tried, checks what changed, and adapts the next protocol from
                evidence instead of vibes.
              </p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {realityLoop.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.metric} className="rounded-lg border border-white/[0.08] bg-black/20 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-[0.12em] text-white/38">
                          {item.metric}
                        </p>
                        <Icon size={17} className="text-[rgb(var(--gold))]" />
                      </div>
                      <p className="mt-4 text-sm text-white/56">
                        {item.before} to <span className="font-semibold text-white">{item.after}</span>
                      </p>
                      <p className="mt-2 text-sm font-semibold text-[rgba(var(--gold),0.86)]">
                        {item.result}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="executive-panel rounded-lg p-6 md:p-8">
              <p className="micro-label">Clinician-ready export</p>
              <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-white">
                Make the appointment smarter before it starts.
              </h2>
              <p className="mt-4 text-base leading-7 text-white/58">
                Aeonvera is not a doctor. Its job is to organize the signal so
                you can ask better questions and share clearer context with one.
              </p>
              <div className="mt-7 space-y-3">
                {clinicianPacket.map((item) => (
                  <div key={item} className="flex gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] p-4 text-sm leading-6 text-white/66">
                    <FileText size={17} className="mt-0.5 flex-none text-[rgb(var(--gold))]" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <Link href="/physician-export" className="premium-action-secondary mt-7 inline-flex rounded-md px-5 py-3 text-sm">
                See export workflow
              </Link>
            </div>
          </div>
        </PageContainer>
      </section>

      <section className="py-12">
        <PageContainer>
          <div className="executive-panel rounded-lg p-6 md:p-8">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <p className="micro-label">Why not do it yourself for free?</p>
                <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-white">
                  You can do pieces of this yourself. The value is the compounding system.
                </h2>
                <p className="mt-4 text-base leading-7 text-white/58">
                  Aeonvera is worth paying for only if it saves attention,
                  improves follow-through, remembers context, and makes better
                  health conversations easier.
                </p>
              </div>
              <div className="space-y-3">
                {comparison.map((row) => (
                  <div key={row.free} className="grid gap-3 rounded-lg border border-white/[0.08] bg-white/[0.025] p-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/34">
                        Free manual path
                      </p>
                      <p className="mt-2 text-sm leading-6 text-white/52">{row.free}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[rgba(var(--gold),0.78)]">
                        Aeonvera
                      </p>
                      <p className="mt-2 text-sm leading-6 text-white/72">{row.aeonvera}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      <section className="py-12 pb-24">
        <PageContainer>
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="executive-panel rounded-lg p-6 md:p-8">
              <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-white/[0.14] bg-white/[0.025]">
                <div className="text-center">
                  <MessageSquareText className="mx-auto text-[rgb(var(--gold))]" size={32} />
                  <p className="mt-4 text-sm font-semibold text-white/76">
                    Founder walkthrough slot
                  </p>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-white/46">
                    Add a real video here when it exists. No fake testimonial,
                    no invented endorsement.
                  </p>
                </div>
              </div>
            </div>
            <div className="executive-panel rounded-lg p-6 md:p-8">
              <p className="micro-label">Start safely</p>
              <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-white">
                Try the demo, then decide if your real data belongs here.
              </h2>
              <p className="mt-4 text-base leading-7 text-white/58">
                The product should earn trust before asking for sensitive health
                information. Start with the sample profile, compare the plans,
                and only create an account when the value is obvious.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/login?mode=signup" className="premium-action px-5 py-3 text-sm">
                  Create account <ArrowRight size={15} />
                </Link>
                <Link href="/pricing" className="premium-action-secondary rounded-md px-5 py-3 text-sm">
                  Compare plans
                </Link>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>
    </div>
  );
}
