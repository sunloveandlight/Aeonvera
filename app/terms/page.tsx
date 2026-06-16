import type { Metadata } from "next";
import Link from "next/link";
import PageContainer from "@/components/ui/PageContainer";

export const metadata: Metadata = {
  title: "Terms of Service | Aeonvera",
  description: "The terms that govern access to and use of Aeonvera.",
};

const effectiveDate = "June 13, 2026";

const sections = [
  {
    title: "Acceptance Of Terms",
    body: [
      "These Terms of Service govern your access to and use of Aeonvera, including the website, mobile app, dashboards, reports, AI features, wearable integrations, calendar features, notifications, and related services.",
      "By creating an account, purchasing a plan, connecting data, or using Aeonvera, you agree to these Terms and our Privacy Policy. If you do not agree, do not use Aeonvera.",
    ],
  },
  {
    title: "Health And Medical Disclaimer",
    body: [
      "Aeonvera provides informational healthspan intelligence, AI-assisted coaching, biological-age estimates, lifestyle protocols, and data organization tools. Aeonvera does not provide medical diagnosis, emergency care, medical treatment, or a clinician-patient relationship.",
      "Always consult a qualified health professional before making medical decisions, changing medication, starting advanced interventions, interpreting lab abnormalities, or acting on symptoms. If you may be experiencing a medical emergency, call emergency services immediately.",
      "Biological-age scores, projections, simulations, risk flags, and optimization protocols are estimates based on available data. They may be incomplete, inaccurate, delayed, or inappropriate for your individual circumstances.",
    ],
  },
  {
    title: "Accounts And Eligibility",
    body: [
      "You must be able to form a binding agreement and be at least the age of majority in your jurisdiction to use Aeonvera. You are responsible for maintaining the confidentiality of your account credentials and for activity under your account.",
      "You agree to provide accurate information and to update it when needed. You may not impersonate another person, access another user’s account, or use Aeonvera for unlawful, harmful, or abusive purposes.",
    ],
  },
  {
    title: "Plans, Billing, And Tier Access",
    body: [
      "Aeonvera offers paid subscription tiers with different features, usage limits, AI depth, wearable access, simulations, voice usage, exports, and automation levels. Tier details may change over time.",
      "Payments, renewals, refunds, taxes, cancellations, and billing management may be handled by Stripe or another payment processor. Unless stated otherwise at checkout, subscriptions renew until cancelled.",
      "If a feature is locked to a higher tier, you may need to upgrade before using it. Aeonvera may enforce monthly usage limits for AI questions, voice conversations, reports, lab imports, simulations, or other metered features.",
    ],
  },
  {
    title: "User Data And Connected Services",
    body: [
      "You are responsible for the information you submit, upload, connect, or authorize, including labs, health files, Apple Health exports, Oura data, WHOOP data, calendar data, voice input, and free-form health notes.",
      "Connected services are governed by their own terms and privacy policies. Aeonvera is not responsible for third-party provider outages, permission changes, data inaccuracies, or connection failures.",
      "You grant Aeonvera the rights needed to process your data to provide and improve the service, including generating reports, protocols, coaching, timeline entries, notifications, and AI outputs.",
    ],
  },
  {
    title: "AI Outputs",
    body: [
      "AI outputs may be incomplete, inaccurate, non-exhaustive, or unsuitable for your circumstances. You should independently evaluate outputs and consult qualified professionals for medical, legal, financial, or other high-stakes decisions.",
      "Aeonvera may use safety rules, tier limits, model routing, clinical disclaimers, refusal behavior, and human-readable reasoning snippets to improve responsible use. You may not use Aeonvera to seek instructions for self-harm, illegal activity, abuse, or dangerous medical actions.",
    ],
  },
  {
    title: "Acceptable Use",
    body: [
      "You may not misuse Aeonvera, interfere with service operation, bypass tier restrictions, scrape the service, reverse engineer protected systems, upload malicious content, violate another person’s rights, or use the service in a way that creates safety, privacy, or security risk.",
      "You may not present Aeonvera outputs as medical diagnosis, professional treatment, or clinician-reviewed advice unless separately reviewed and approved by a qualified professional.",
    ],
  },
  {
    title: "Intellectual Property",
    body: [
      "Aeonvera, including its software, design, branding, workflows, models, generated interface structures, and platform content, is owned by Aeonvera or its licensors and is protected by applicable intellectual property laws.",
      "You retain rights to the personal information and content you provide, subject to the license needed for Aeonvera to operate the service. You may use your own reports and exports for personal, clinician, or advisory purposes.",
    ],
  },
  {
    title: "Availability And Changes",
    body: [
      "Aeonvera may change, suspend, limit, or discontinue features, providers, tiers, models, data sources, or integrations. We aim for high reliability, but we do not guarantee uninterrupted or error-free operation.",
      "Wearable APIs, AI providers, app store requirements, payment systems, and calendar providers may change independently of Aeonvera. These changes can affect feature behavior or availability.",
    ],
  },
  {
    title: "Limitation Of Liability",
    body: [
      "To the maximum extent permitted by law, Aeonvera is provided as is and as available, without warranties of any kind. Aeonvera is not liable for indirect, incidental, consequential, special, exemplary, or punitive damages, or for lost profits, lost data, health outcomes, or business losses.",
      "Some jurisdictions do not allow certain limitations, so some terms may not apply to you. In those cases, liability is limited to the greatest extent permitted by law.",
    ],
  },
  {
    title: "Termination",
    body: [
      "You may stop using Aeonvera at any time. We may suspend or terminate access if you violate these Terms, create risk, fail to pay, misuse the service, or if continued access would be unlawful or harmful.",
      "Sections that by their nature should survive termination, including health disclaimers, intellectual property, limitation of liability, payment obligations, and dispute-related provisions, will survive.",
    ],
  },
  {
    title: "Changes To These Terms",
    body: [
      "We may update these Terms as Aeonvera evolves. If changes are material, we will provide notice through the site, app, email, or another reasonable method. Continued use after changes means you accept the updated Terms.",
    ],
  },
  {
    title: "Contact",
    body: [
      "Questions about these Terms can be sent to info@aeonvera.com.",
    ],
  },
];

export default function TermsPage() {
  return (
    <PageContainer>
      <main className="py-14 md:py-20">
        <section className="executive-panel rounded-lg p-6 md:p-10">
          <p className="micro-label">Terms of Service</p>
          <h1 className="mt-5 max-w-4xl leading-tight text-white text-5xl md:text-6xl font-semibold">
            Clear terms for a private health intelligence system.
          </h1>
          <p className="mt-6 max-w-3xl text-sm leading-7 text-white/52">
            Effective {effectiveDate}. These terms govern access to Aeonvera&apos;s
            website, mobile app, AI systems, healthspan dashboards, and connected services.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/privacy"
              className="premium-action-secondary inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-medium"
            >
              Privacy Policy
            </Link>
            <a
              href="mailto:info@aeonvera.com"
              className="premium-action inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-medium"
            >
              Contact terms
            </a>
          </div>
        </section>

        <section className="mt-6 grid gap-4">
          {sections.map((section) => (
            <article key={section.title} className="executive-panel rounded-lg p-6 md:p-8">
              <h2 className="text-2xl font-light text-white">{section.title}</h2>
              <div className="mt-5 space-y-4">
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-7 text-white/52">
                    {paragraph}
                  </p>
                ))}
              </div>
            </article>
          ))}
        </section>
      </main>
    </PageContainer>
  );
}
