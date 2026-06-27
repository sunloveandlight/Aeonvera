import type { Metadata } from "next";
import Image from "next/image";
import { Bell, Clock3, Gift, Tag } from "lucide-react";

import WaitlistForm from "./WaitlistForm";

const foundingBenefits = [
  {
    icon: Clock3,
    title: "Early access",
    body: "Be first in line when onboarding opens.",
  },
  {
    icon: Tag,
    title: "Launch discount",
    body: "Founding members receive the best launch pricing.",
  },
  {
    icon: Gift,
    title: "Lifetime bonuses",
    body: "Exclusive perks you keep as Aeonvera evolves.",
  },
  {
    icon: Bell,
    title: "Exclusive updates",
    body: "Private product notes and longevity intelligence drops.",
  },
];

export const metadata: Metadata = {
  title: "Aeonvera Early Access",
  description:
    "Join the Aeonvera early access list for private longevity intelligence.",
  alternates: {
    canonical: "/waitlist",
  },
  openGraph: {
    title: "Aeonvera Early Access",
    description:
      "Join the early access list for Aeonvera private longevity intelligence.",
    url: "/waitlist",
    images: [
      {
        url: "/marketing/rejuvenation-woman.png",
        width: 1536,
        height: 1024,
        alt: "Aeonvera longevity intelligence.",
      },
    ],
  },
};

export default function WaitlistPage() {
  return (
    <div className="waitlist-page" data-waitlist-page>
      <div className="waitlist-backdrop" aria-hidden="true">
        <div className="waitlist-scanline" />
        <div className="waitlist-arc waitlist-arc-top" />
        <div className="waitlist-arc waitlist-arc-bottom" />
      </div>

      <main className="waitlist-shell">
        <section className="waitlist-copy">
          <div className="waitlist-brand">
            AEONVERA
          </div>

          <p className="waitlist-launch-date">Launching August 19, 2026</p>

          <h1>
            Join the Founding Members List
          </h1>

          <p className="waitlist-tagline">
            The app that grows younger with you.
          </p>

          <p className="waitlist-lede">
            Aeonvera is opening soon. Get priority access to the private
            longevity intelligence system built for labs, wearables,
            biological age, protocols, and physician-ready insight.
          </p>

          <WaitlistForm />

          <div className="waitlist-benefits" aria-label="Founding member benefits">
            {foundingBenefits.map((benefit) => (
              <div className="waitlist-benefit" key={benefit.title}>
                <benefit.icon aria-hidden size={20} />
                <h2>{benefit.title}</h2>
                <p>{benefit.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="waitlist-visual" aria-label="Aeonvera preview" aria-hidden="true">
          <Image
            alt=""
            className="waitlist-portrait"
            fill
            priority
            sizes="(max-width: 900px) 100vw, 48vw"
            src="/marketing/founding-members-visual.png"
          />
        </section>
      </main>
    </div>
  );
}
