import type { Metadata } from "next";
import ProfessionalDashboardClient from "./ProfessionalDashboardClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Professional Dashboard",
};

export default function ProfessionalDashboardPage() {
  return <ProfessionalDashboardClient />;
}
