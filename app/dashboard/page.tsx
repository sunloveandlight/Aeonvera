"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace("/login");
          return;
        }

        // Get profile (single reliable fetch)
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("onboarding_completed, plan, subscription_status")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error(error);
          setLoading(false);
          return;
        }

        // No profile → safe fallback (don’t loop redirect)
        if (!profile) {
          setLoading(false);
          return;
        }

        // 🔒 onboarding gate
        if (!profile.onboarding_completed) {
          router.replace("/onboarding");
          return;
        }

        // 🔑 subscription validation (REAL RULE)
        const isPaid =
          profile.subscription_status === "active" ||
          profile.subscription_status === "trialing";

        const plan = profile.plan;

        // If user has no valid subscription → pricing
        if (!isPaid || !plan) {
          router.replace("/pricing");
          return;
        }

        // ❌ REMOVED: elite-only restriction (this was your bug)

        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };

    run();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white bg-black">
        Loading...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-10">
      <h1 className="text-3xl">Dashboard</h1>
    </main>
  );
}