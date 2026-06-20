import type { Metadata } from "next";
import Link from "next/link";
import PageContainer from "@/components/ui/PageContainer";

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

const signals = [
  { label: "Biological age", value: "37.8", detail: "1.9 years above chronological baseline" },
  { label: "Recovery", value: "74%", detail: "Sleep improved, HRV still under target" },
  { label: "Metabolic risk", value: "Moderate", detail: "A1c and triglycerides need follow-up" },
  { label: "Execution", value: "68%", detail: "Strength completed, Zone 2 inconsistent" },
];

const nextActions = [
  "Schedule two Zone 2 blocks before Friday",
  "Retest fasting glucose after seven consistent sleep nights",
  "Share the physician packet before the next appointment",
];

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-white">
      <section className="pt-24 pb-12 md:pt-32">
        <PageContainer>
          <div className="mx-auto max-w-4xl text-center">
            <p className="micro-label">Demo workspace</p>
            <h1 className="mt-5 text-5xl font-semibold leading-[0.98] tracking-tight md:text-7xl">
              See the system before your data connects.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/58">
              This sample workspace shows how Aeonvera turns labs, wearables,
              daily execution, and clinician sharing into one private operating
              system for longevity.
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

      <section className="pb-24">
        <PageContainer>
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="executive-panel rounded-lg p-6 md:p-8">
              <p className="micro-label">Sample signal map</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {signals.map((signal) => (
                  <div key={signal.label} className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-4">
                    <p className="text-xs uppercase tracking-[0.12em] text-white/38">{signal.label}</p>
                    <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{signal.value}</p>
                    <p className="mt-3 text-sm leading-6 text-white/52">{signal.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="executive-panel rounded-lg p-6 md:p-8">
              <p className="micro-label">What Aeonvera would do next</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white">
                One useful plan, not a pile of charts.
              </h2>
              <div className="mt-6 space-y-3">
                {nextActions.map((action, index) => (
                  <div key={action} className="rounded-lg border border-[rgba(var(--gold),0.18)] bg-[rgba(var(--gold),0.045)] p-4">
                    <p className="av-eyebrow text-[rgba(var(--gold),0.78)]">
                      Step {index + 1}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white/68">{action}</p>
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
    </div>
  );
}
