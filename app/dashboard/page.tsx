"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        router.replace("/login");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("user_id", data.session.user.id)
        .single();

      if (error) {
        console.error("Profile fetch error:", error);
        setLoading(false);
        return;
      }

      if (profile && profile.onboarding_completed === false) {
        router.replace("/onboarding");
        return;
      }

      setLoading(false);
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