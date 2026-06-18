import type { Metadata } from "next";
import { redirect } from "next/navigation";
import OptimizationPageClient from "./OptimizationPageClient";
import { isUserAllowed, type Plan, type SubscriptionStatus } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Optimization",
  description:
    "Generate personalized longevity protocols from your assessment, labs, wearable signals, and biological-age trajectory.",
  alternates: {
    canonical: "/optimization",
  },
  openGraph: {
    title: "Aeonvera Optimization",
    description:
      "Turn health signals into clear longevity protocols and daily execution.",
    url: "/optimization",
  },
  twitter: {
    card: "summary",
    title: "Aeonvera Optimization",
    description:
      "Personalized longevity protocols from your labs, wearables, and assessment.",
  },
};

export default async function OptimizationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?mode=signin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan,subscription_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    !isUserAllowed(
      (profile?.plan as Plan | null) || null,
      (profile?.subscription_status as SubscriptionStatus | null) || null
    )
  ) {
    redirect("/pricing");
  }

  return <OptimizationPageClient />;
}
