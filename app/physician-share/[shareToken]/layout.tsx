import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Secure Clinical Share",
  description:
    "Open a read-only Aeonvera clinical healthspan summary shared by a member.",
  openGraph: {
    title: "Secure Clinical Share | Aeonvera",
    description:
      "Open a read-only Aeonvera clinical healthspan summary shared by a member.",
    type: "website",
  },
  robots: {
    follow: false,
    index: false,
  },
};

export default function PhysicianShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
