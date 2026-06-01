"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/auth/ensureProfile";

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        // ✅ FIX: stable auth source
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace("/login");
          return;
        }

        const userId = user.id;

        await ensureProfile(userId);

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("onboarding_completed, plan")
          .eq("user_id", userId)
          .maybeSingle();

        if (error) {
          console.error("Profile fetch error:", error);
          setLoading(false);
          return;
        }

        if (!profile?.onboarding_completed) {
          router.replace("/onboarding");
          return;
        }

        if (profile?.plan && profile.plan !== "elite") {
          router.replace("/pricing");
          return;
        }

        setLoading(false);
      } catch (err) {
        console.error("Dashboard crash guard:", err);
        setLoading(false);
      }
    };

    check();
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