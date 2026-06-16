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

export default function PricingPage() {
  return <PricingPageClient />;
}
