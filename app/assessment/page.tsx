import type { Metadata } from "next";
import AssessmentPageClient from "./AssessmentPageClient";

export const metadata: Metadata = {
  title: "Assessment",
  description:
    "Start Aeonvera with a private biological-age and longevity assessment that builds your baseline health intelligence.",
  alternates: {
    canonical: "/assessment",
  },
  openGraph: {
    title: "Aeonvera Assessment",
    description:
      "Create your biological-age baseline and unlock private longevity intelligence.",
    url: "/assessment",
  },
  twitter: {
    card: "summary",
    title: "Aeonvera Assessment",
    description:
      "Start with a private biological-age and longevity assessment.",
  },
};

export default function AssessmentPage() {
  return <AssessmentPageClient />;
}
