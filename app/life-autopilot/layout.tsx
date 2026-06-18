import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Life Autopilot",
  description:
    "Let Aeonvera run your daily health plan — proactive coaching, reminders, and calendar-aware protocol actions.",
  openGraph: {
    title: "Life Autopilot | Aeonvera",
    description:
      "Proactive, calendar-aware health coaching that runs your daily protocol for you.",
  },
};

export default function LifeAutopilotLayout({ children }: { children: React.ReactNode }) {
  return children;
}
