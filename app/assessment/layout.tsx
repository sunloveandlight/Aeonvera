import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Assessment",
  description:
    "Start with your biological-age baseline. A few minutes builds your private Aeonvera health profile.",
  openGraph: {
    title: "Assessment | Aeonvera",
    description: "Start with your biological-age baseline and build your health profile.",
  },
};

export default function AssessmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
