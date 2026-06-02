"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { isUserAllowed } from "@/lib/auth/permissions";

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

        if (!profile) {
          setLoading(false);
          return;
        }

        // ----------------------------
        // ONBOARDING GATE
        // ----------------------------
        if (!profile.onboarding_completed) {
          router.replace("/onboarding");
          return;
        }

        // ----------------------------
        // SINGLE SOURCE OF TRUTH ACCESS CHECK
        // ----------------------------
        const allowed = isUserAllowed(
          profile.plan,
          profile.subscription_status
        );

        if (!allowed) {
          router.replace("/pricing");
          return;
        }

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