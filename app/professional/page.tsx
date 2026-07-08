import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ClipboardCheck, FileLock2, ShieldCheck, Stethoscope } from "lucide-react";

export const metadata: Metadata = {
  title: "Aeonvera for Clinics",
  description:
    "A professional longevity workspace for consented roster profiles, clinician-ready context, and auditable PHI access.",
};

const CAPABILITIES = [
  {
    icon: Stethoscope,
    title: "Roster profiles",
    body: "Create organization-owned profiles for patients, clients, or members without mixing them into consumer accounts.",
  },
  {
    icon: FileLock2,
    title: "Consent-bound access",
    body: "Sensitive data classes require documented basis or member-granted consent before the team can view them.",
  },
  {
    icon: ClipboardCheck,
    title: "Clinician-ready exports",
    body: "Share biological age context, labs, recovery signals, and plans in a format built for review.",
  },
  {
    icon: ShieldCheck,
    title: "Audit trail",
    body: "Every professional PHI access decision is recorded with actor, role, route, profile, and data classes.",
  },
] as const;

export default function ProfessionalPage() {
  return (
    <main className="min-h-screen">
      <section className="px-6 pt-32 pb-20 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div>
            <p className="text-eyebrow">For clinics</p>
            <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-[1.02] tracking-tight text-white md:text-7xl">
              Bring longevity intelligence into a governed care workspace.
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-8 text-white/58">
              Aeonvera Professional gives clinics and performance teams a private
              roster, consent-aware data access, physician-ready exports, and a
              durable audit trail for every sensitive profile touch.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login?mode=signup"
                className="premium-action inline-flex h-12 items-center justify-center gap-2 rounded-md px-6 text-sm font-medium"
              >
                Create clinic workspace
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/professional/dashboard"
                className="premium-action-secondary inline-flex h-12 items-center justify-center rounded-md px-6 text-sm font-medium"
              >
                Clinic sign in
              </Link>
            </div>
          </div>

          <div className="premium-surface rounded-2xl p-6">
            <p className="text-eyebrow">Governance model</p>
            <div className="mt-6 space-y-4">
              {[
                ["Personal profiles", "Consumer app access only"],
                ["Roster profiles", "Organization workspace only"],
                ["Sensitive classes", "Consent or documented basis"],
                ["Professional reads", "Access decision plus audit event"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-start justify-between gap-5 rounded-lg border border-white/[0.08] bg-white/[0.035] p-4"
                >
                  <span className="text-sm text-white/52">{label}</span>
                  <span className="max-w-[12rem] text-right text-sm font-medium text-white/82">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/[0.08] px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-eyebrow">Built for sensitive teams</p>
            <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-white md:text-5xl">
              The professional surface keeps access narrow, explicit, and reviewable.
            </h2>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {CAPABILITIES.map(({ icon: Icon, title, body }) => (
              <article key={title} className="premium-surface rounded-2xl p-7">
                <div className="premium-status flex size-10 items-center justify-center rounded-lg">
                  <Icon size={18} />
                </div>
                <h3 className="mt-5 text-xl font-semibold tracking-tight text-white">
                  {title}
                </h3>
                <p className="mt-4 text-sm leading-7 text-white/52">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/[0.08] px-6 py-24 text-center lg:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-eyebrow">Launch-ready boundary</p>
          <h2 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-tight text-white md:text-6xl">
            Consumer health and roster PHI stay separate.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-white/52">
            Aeonvera Professional is designed around the contract your launch
            depends on: the right profile, the right basis, and an audit event
            whenever sensitive roster data is touched.
          </p>
        </div>
      </section>
    </main>
  );
}
