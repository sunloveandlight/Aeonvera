import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Life Autopilot",
  description:
    "Let Aeonvera run your daily health plan — proactive coaching, reminders, and calendar-aware protocol actions.",
  openGraph: {
    title: "Life Autopilot | Aeonvera",
    description:
      "Proactive, calendar-aware health coaching that runs your daily protocol for you.",
    images: [
      {
        url: "/marketing/rejuvenation-woman.png",
        width: 1536,
        height: 1024,
        alt: "Aeonvera Life Autopilot.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Life Autopilot | Aeonvera",
    description:
      "Proactive, calendar-aware health coaching that runs your daily protocol for you.",
    images: ["/marketing/rejuvenation-woman.png"],
  },
};

export default function LifeAutopilotLayout({ children }: { children: React.ReactNode }) {
  return children;
}
