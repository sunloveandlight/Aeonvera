import type { Metadata } from "next";
import Link from "next/link";
import PageContainer from "@/components/ui/PageContainer";

export const metadata: Metadata = {
  title: "Privacy Policy | Aeonvera",
  description: "How Aeonvera collects, uses, protects, and shares personal health intelligence data.",
};

const effectiveDate = "June 13, 2026";

const sections = [
  {
    title: "What Aeonvera Is",
    body: [
      "Aeonvera is a private longevity intelligence platform. We help users organize healthspan information, generate AI-assisted insights, track biological-age signals, receive coaching messages, connect wearables, import labs, and schedule protocol actions.",
      "Aeonvera is not an emergency service, medical diagnosis service, or replacement for a licensed clinician. Health outputs are informational and should be reviewed with qualified professionals before decisions involving diagnosis, treatment, medication, or high-risk interventions.",
    ],
  },
  {
    title: "Information We Collect",
    body: [
      "Account information, including email address, authentication identifiers, subscription tier, billing status, and basic profile details you provide.",
      "Health and fitness information, including assessment answers, wearable data, Apple Health imports, Oura or WHOOP data you authorize, sleep, heart rate, HRV, activity, recovery, biological-age calculations, lab biomarkers, uploaded health files or images, and manually entered health notes.",
      "AI interaction information, including questions, voice transcripts, generated answers, clinical follow-up context, optimization protocols, feedback on actions, and coach memory signals.",
      "Calendar and notification information, including connected calendar status, scheduled protocol events, push tokens, device platform, notification preferences, quiet hours, and delivery history.",
      "Payment and plan information, including subscription plan, Stripe customer state, checkout events, and billing portal status. Aeonvera does not store full card numbers.",
      "Technical information, including browser or app interactions, device type, approximate network information, logs, diagnostics, error states, and security-related metadata needed to operate the service.",
    ],
  },
  {
    title: "How We Use Information",
    body: [
      "To provide the service, including dashboards, AI reports, biological-age estimates, future-self simulations, digital twin timelines, wearable sync, calendar scheduling, notifications, and mobile companion features.",
      "To personalize healthspan intelligence, including daily coaching, plan recommendations, intervention sequencing, usage limits, tier access, and safety-aware AI responses.",
      "To maintain security, prevent misuse, debug errors, operate infrastructure, process payments, send transactional communications, and comply with legal obligations.",
      "To improve product quality using aggregated, de-identified, or operational analytics where practical. We do not sell personal health data.",
    ],
  },
  {
    title: "Wearables, Labs, And Connected Services",
    body: [
      "If you connect Oura, WHOOP, Apple Health exports, Google Calendar, native device calendar, push notifications, or another supported service, Aeonvera receives only the information authorized through that connection or upload.",
      "You can disconnect a wearable or revoke access through the provider account where available. Historical data already imported into Aeonvera may remain in your account unless you request deletion or remove it through product controls we provide.",
    ],
  },
  {
    title: "AI Providers And Processing",
    body: [
      "Aeonvera may send relevant prompts, health context, transcripts, or structured summaries to AI model providers so the service can generate answers, protocols, safety checks, and coaching language.",
      "We work to minimize unnecessary data sent to AI systems, but health-related AI features may require personal context to be useful. Do not submit information you do not want processed by Aeonvera or its service providers.",
    ],
  },
  {
    title: "When We Share Information",
    body: [
      "Service providers: We use vendors for hosting, database, authentication, payments, email, push notifications, AI processing, analytics/diagnostics, and connected-device integrations. These providers process information for Aeonvera business purposes.",
      "User-directed sharing: If you export reports, connect calendars, open provider OAuth flows, or share future-self scenario links, information may be shared according to your actions and settings.",
      "Legal and safety reasons: We may disclose information if required by law, to protect rights and security, to investigate abuse, or to respond to lawful requests.",
      "Business transfers: If Aeonvera is involved in a merger, financing, acquisition, reorganization, or sale of assets, user information may be transferred subject to this policy or a successor policy with notice where required.",
    ],
  },
  {
    title: "Your Choices And Controls",
    body: [
      "You can choose whether to provide assessment answers, upload labs, connect wearables, enable push notifications, connect calendars, use voice features, or receive email notifications.",
      "You can request access, correction, export, or deletion of personal information by contacting us. Some data may be retained where required for security, legal compliance, billing records, dispute resolution, or backup integrity.",
      "You can manage billing through Stripe, revoke provider connections through connected services, adjust notification preferences in Aeonvera, and disable push permissions at the device level.",
    ],
  },
  {
    title: "Security And Retention",
    body: [
      "We use technical and organizational safeguards designed to protect personal information, including access controls, encrypted transport, provider-level security features, and restricted administrative access.",
      "No internet service can be guaranteed perfectly secure. We retain information for as long as needed to operate Aeonvera, provide requested features, comply with obligations, resolve disputes, and maintain security.",
    ],
  },
  {
    title: "Children",
    body: [
      "Aeonvera is intended for adults. We do not knowingly collect personal information from children under 13. If you believe a child has provided information, contact us and we will take appropriate steps.",
    ],
  },
  {
    title: "International Use",
    body: [
      "Aeonvera is operated from North America and may process information in the United States, Canada, or other locations where our service providers operate. By using Aeonvera, you understand that information may be processed outside your region.",
    ],
  },
  {
    title: "Changes To This Policy",
    body: [
      "We may update this Privacy Policy as Aeonvera evolves. If changes are material, we will provide notice through the site, app, email, or another reasonable method. The effective date above shows when this version took effect.",
    ],
  },
  {
    title: "Contact",
    body: [
      "For privacy requests or questions, contact info@aeonvera.com.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <PageContainer>
      <main className="py-14 md:py-20">
        <section className="executive-panel rounded-lg p-6 md:p-10">
          <p className="micro-label">Privacy Policy</p>
          <h1 className="mt-5 max-w-4xl leading-tight text-white text-5xl md:text-6xl font-semibold">
            Private health intelligence deserves plain-language privacy.
          </h1>
          <p className="mt-6 max-w-3xl text-sm leading-7 text-white/52">
            Effective {effectiveDate}. This policy explains what Aeonvera collects,
            why it is used, and how users can control their information.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/terms"
              className="premium-action-secondary inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-medium"
            >
              Terms of Service
            </Link>
            <a
              href="mailto:info@aeonvera.com"
              className="premium-action inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-medium"
            >
              Contact privacy
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
