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
    images: [
      {
        url: "/marketing/rejuvenation-woman.png",
        width: 1536,
        height: 1024,
        alt: "Aeonvera biological-age assessment.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aeonvera Assessment",
    description:
      "Start with a private biological-age and longevity assessment.",
    images: ["/marketing/rejuvenation-woman.png"],
  },
};

export default function AssessmentPage() {
  return <AssessmentPageClient />;
}
