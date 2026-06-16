import type { Metadata } from "next";
import HomePageClient from "./HomePageClient";

export const metadata: Metadata = {
  title: "Aeonvera | Private Longevity Intelligence",
  description:
    "Aeonvera turns labs, wearables, biological age, and daily execution into a private longevity intelligence system.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Aeonvera | Private Longevity Intelligence",
    description:
      "Private longevity intelligence for the body you are becoming.",
    url: "/",
    images: [
      {
        url: "/marketing/rejuvenation-woman.png",
        width: 1536,
        height: 1024,
        alt: "A futuristic Aeonvera longevity transformation portrait.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aeonvera | Private Longevity Intelligence",
    description:
      "Private longevity intelligence for labs, wearables, biological age, and execution.",
    images: ["/marketing/rejuvenation-woman.png"],
  },
};

export default function HomePage() {
  return <HomePageClient />;
}
