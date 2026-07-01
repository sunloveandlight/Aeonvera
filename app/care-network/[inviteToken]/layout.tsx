import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Care Network Invitation",
  description:
    "Open a secure Aeonvera care network invitation and read-only healthspan view.",
  openGraph: {
    title: "Care Network Invitation | Aeonvera",
    description:
      "Open a secure Aeonvera care network invitation and read-only healthspan view.",
    type: "website",
  },
  robots: {
    follow: false,
    index: false,
  },
};

export default function CareNetworkInviteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
