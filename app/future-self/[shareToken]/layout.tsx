import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shared Future-Self Scenario",
  description:
    "Open a read-only Aeonvera future-self scenario and healthspan trajectory.",
  openGraph: {
    title: "Shared Future-Self Scenario | Aeonvera",
    description:
      "Open a read-only Aeonvera future-self scenario and healthspan trajectory.",
    type: "website",
  },
  robots: {
    follow: false,
    index: false,
  },
};

export default function SharedFutureSelfLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
