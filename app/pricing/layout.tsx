import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Choose your level of Aeonvera longevity intelligence — Core, Elite, or Sovereign. Compare plans and what each includes.",
  openGraph: {
    title: "Pricing | Aeonvera",
    description:
      "Choose your level of Aeonvera longevity intelligence — Core, Elite, or Sovereign.",
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
