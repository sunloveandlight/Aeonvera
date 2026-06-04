"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { isUserAllowed } from "@/lib/auth/permissions";

type Profile = {
  display_name: string | null;
  plan: string | null;
  subscription_status: string | null;
  date_of_birth: string | null;
  primary_goal: string | null;
};

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

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

        const { data, error: profileError } = await supabase
          .from("profiles")
          .select(
            "display_name, plan, subscription_status, date_of_birth, primary_goal"
          )
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileError) {
          console.error(profileError);
          setError("Failed to load profile");
          setLoading(false);
          return;
        }

        if (!data) {
          router.replace("/onboarding");
          return;
        }

        if (!isUserAllowed(data.plan, data.subscription_status)) {
          router.replace("/pricing");
          return;
        }

        setProfile(data);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError("Something went wrong. Please try again.");
        setLoading(false);
      }
    };

    run();
  }, [router]);

  async function openBillingPortal() {
    try {
      setOpeningPortal(true);

      const res = await fetch("/api/stripe/customer-portal", {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to open portal");
      }

      window.location.href = data.url;
    } catch (err) {
      console.error(err);
      alert("Failed to open billing portal.");
    } finally {
      setOpeningPortal(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="animate-pulse text-white/60">
          Initializing Aeonvera Intelligence System...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-red-400">
        {error}
      </div>
    );
  }

  const initials =
    profile?.display_name?.slice(0, 2).toUpperCase() || "AU";

  return (
    <main className="min-h-screen bg-black text-white p-8 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.15),transparent_60%)]" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between mb-10">
        <div>
          <h1 className="text-2xl font-light tracking-wide">
            AEONVERA
          </h1>
          <p className="text-white/50 text-sm">
            Longevity Intelligence System
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-white/70 text-sm">
              {profile?.display_name || "User"}
            </p>
            <p className="text-white/40 text-xs">
              {profile?.plan?.toUpperCase() || "CORE"}
            </p>
          </div>

          <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
            {initials}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
        {/* System Status */}
        <div className="p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
          <h2 className="text-sm text-white/50 mb-2">
            SYSTEM STATUS
          </h2>
          <p className="text-green-400 text-lg font-medium">
            ONLINE
          </p>
          <p className="text-white/40 text-sm mt-2">
            Connected to Aeonvera Core Systems
          </p>
        </div>

        {/* Identity */}
        <div className="p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
          <h2 className="text-sm text-white/50 mb-2">
            IDENTITY PROFILE
          </h2>

          <p className="text-lg">
            {profile?.display_name || "Unnamed User"}
          </p>

          <p className="text-white/40 text-sm mt-2">
            Goal: {profile?.primary_goal || "Not set"}
          </p>

          <p className="text-white/40 text-sm">
            DOB: {profile?.date_of_birth || "Not provided"}
          </p>
        </div>

        {/* Digital Twin */}
        <div className="p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
          <h2 className="text-sm text-white/50 mb-2">
            DIGITAL TWIN STATUS
          </h2>

          <p className="text-yellow-400">
            INITIALIZATION REQUIRED
          </p>

          <p className="text-white/40 text-sm mt-2">
            Complete Longevity Assessment to activate model
          </p>
        </div>

        {/* Intelligence Engine */}
        <div className="p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
          <h2 className="text-sm text-white/50 mb-2">
            INTELLIGENCE ENGINE
          </h2>

          <p className="text-white/70">
            Awaiting first assessment data
          </p>

          <div className="mt-4 space-y-2 text-sm text-white/40">
            <p>• Longevity Score: Pending</p>
            <p>• Risk Profile: Pending</p>
            <p>• Optimization Plan: Pending</p>
          </div>
        </div>

        {/* Mission Control */}
        <div className="p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl md:col-span-2">
          <h2 className="text-sm text-white/50 mb-4">
            MISSION CONTROL
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-4 border border-white/10 rounded-xl">
              Account Created ✓
            </div>

            <div className="p-4 border border-white/10 rounded-xl">
              Onboarding Complete ✓
            </div>

            <div className="p-4 border border-white/10 rounded-xl text-yellow-400">
              Assessment Pending
            </div>
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="relative z-10 mt-10 flex gap-4">
        <button
          onClick={() => router.push("/assessment")}
          className="px-6 py-3 rounded-xl bg-white text-black font-medium hover:bg-white/90 transition"
        >
          Start Longevity Assessment
        </button>

        <button
          onClick={openBillingPortal}
          disabled={openingPortal}
          className="px-6 py-3 rounded-xl border border-white/20 text-white/80 hover:bg-white/5 transition"
        >
          {openingPortal
            ? "Opening..."
            : "Manage Subscription"}
        </button>
      </div>
    </main>
  );
}