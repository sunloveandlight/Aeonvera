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

        // 🔥 WAIT FOR PROFILE TO EXIST (RETRY SAFE)
        let profile = null;

        for (let i = 0; i < 5; i++) {
          const { data } = await supabase
            .from("profiles")
            .select("onboarding_completed, plan")
            .eq("user_id", user.id)
            .maybeSingle();

          if (data) {
            profile = data;
            break;
          }

          await new Promise((r) => setTimeout(r, 300));
        }

        if (!profile) {
          // default safe state instead of redirect loop
          setLoading(false);
          return;
        }

        if (!profile.onboarding_completed) {
          router.replace("/onboarding");
          return;
        }

        // 🔥 IMPORTANT FIX:
        // don't hard-block users with missing plan
        if (!profile.plan) {
          setLoading(false);
          return;
        }

        if (profile.plan !== "elite") {
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