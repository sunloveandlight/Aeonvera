"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { isUserAllowed } from "@/lib/auth/permissions";

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("onboarding_completed, plan, subscription_status")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileError) {
          console.error("Profile fetch error:", profileError);
          setError("Failed to load profile");
          setLoading(false);
          return;
        }

        // No profile → should not happen but handle gracefully
        if (!profile) {
          router.replace("/onboarding");
          return;
        }

        // ------------------- ONBOARDING GATE -------------------
        if (!profile.onboarding_completed) {
          router.replace("/onboarding");
          return;
        }

        // ------------------- SUBSCRIPTION GATE -------------------
        const allowed = isUserAllowed(
          profile.plan,
          profile.subscription_status
        );

        if (!allowed) {
          router.replace("/pricing");
          return;
        }

        // User is good to go
        setLoading(false);
      } catch (err) {
        console.error("Dashboard init error:", err);
        setError("Something went wrong. Please try again.");
        setLoading(false);
      }
    };

    run();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white bg-black">
        <div className="text-center">
          <div className="animate-spin w-6 h-6 border-2 border-white/20 border-t-white rounded-full mx-auto mb-4"></div>
          Loading dashboard...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white bg-black">
        <div className="text-center max-w-md">
          <h2 className="text-xl mb-4">Error</h2>
          <p className="text-zinc-400 mb-6">{error}</p>
          <button
            onClick={() => router.replace("/pricing")}
            className="px-6 py-3 bg-white text-black rounded-xl"
          >
            Go to Pricing
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-10">
      <h1 className="text-3xl">Dashboard</h1>
      {/* Your actual dashboard content */}
    </main>
  );
}