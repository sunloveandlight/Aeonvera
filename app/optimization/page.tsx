import type { Metadata } from "next";
import OptimizationPageClient from "./OptimizationPageClient";

export const metadata: Metadata = {
  title: "Optimization",
  description:
    "Generate personalized longevity protocols from your assessment, labs, wearable signals, and biological-age trajectory.",
  alternates: {
    canonical: "/optimization",
  },
  openGraph: {
    title: "Aeonvera Optimization",
    description:
      "Turn health signals into clear longevity protocols and daily execution.",
    url: "/optimization",
  },
  twitter: {
    card: "summary",
    title: "Aeonvera Optimization",
    description:
      "Personalized longevity protocols from your labs, wearables, and assessment.",
  },
};

export default function OptimizationPage() {
  return <OptimizationPageClient />;
}
