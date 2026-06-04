"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { isUserAllowed } from "@/lib/auth/permissions";

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);

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
          .select(
            "onboarding_completed, plan, subscription_status"
          )
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileError) {
          console.error("Profile fetch error:", profileError);
          setError("Failed to load profile");
          setLoading(false);
          return;
        }

        if (!profile) {
          router.replace("/onboarding");
          return;
        }

        if (!profile.onboarding_completed) {
          router.replace("/onboarding");
          return;
        }

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
        console.error("Dashboard init error:", err);
        setError("Something went wrong. Please try again.");
        setLoading(false);
      }
    };

    run();
  }, [router]);

  async function openBillingPortal() {
    try {
      setOpeningPortal(true);

      const res = await fetch(
        "/api/stripe/customer-portal",
        {
          method: "POST",
          credentials: "include",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || "Failed to open portal"
        );
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
      <div className="min-h-screen flex items-center justify-center text-white bg-black">
        Loading dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white bg-black">
        {error}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-10">
      <h1 className="text-3xl mb-8">
        Dashboard
      </h1>

      <button
        onClick={openBillingPortal}
        disabled={openingPortal}
        className="px-6 py-3 bg-white text-black rounded-xl font-medium"
      >
        {openingPortal
          ? "Opening..."
          : "Manage Subscription"}
      </button>
    </main>
  );
}