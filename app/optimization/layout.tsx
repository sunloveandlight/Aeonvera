import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Optimization",
  description:
    "Turn your labs, wearables, and biological-age signals into a clear daily protocol with Aeonvera.",
  openGraph: {
    title: "Optimization | Aeonvera",
    description:
      "Turn your health signals into a clear daily protocol with Aeonvera.",
  },
};

export default function OptimizationLayout({ children }: { children: React.ReactNode }) {
  return children;
}
