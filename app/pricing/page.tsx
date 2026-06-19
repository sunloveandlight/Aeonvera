import type { Metadata } from "next";
import PricingPageClient from "./PricingPageClient";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Compare Aeonvera Core, Elite, and Sovereign memberships for private longevity intelligence, AI coaching, and digital twin features.",
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title: "Aeonvera Pricing",
    description:
      "Choose the Aeonvera membership that fits your longevity intelligence and execution needs.",
    url: "/pricing",
  },
  twitter: {
    card: "summary",
    title: "Aeonvera Pricing",
    description:
      "Compare Core, Elite, and Sovereign longevity intelligence memberships.",
  },
};

const pricingJsonLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Aeonvera Membership",
  description:
    "Private longevity intelligence memberships — Core, Elite, and Sovereign — with AI coaching, lab analysis, and digital twin features.",
  brand: {
    "@type": "Brand",
    name: "Aeonvera",
  },
  offers: [
    {
      "@type": "Offer",
      name: "Core",
      price: "49",
      priceCurrency: "USD",
      url: "https://www.aeonvera.com/pricing",
    },
    {
      "@type": "Offer",
      name: "Elite",
      price: "199",
      priceCurrency: "USD",
      url: "https://www.aeonvera.com/pricing",
    },
    {
      "@type": "Offer",
      name: "Sovereign",
      price: "999",
      priceCurrency: "USD",
      url: "https://www.aeonvera.com/pricing",
    },
  ],
};

export default function PricingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd) }}
      />
      <PricingPageClient />
    </>
  );
}
