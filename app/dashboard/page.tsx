"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { getSessionUser } from "@/lib/auth/getSessionUser";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const init = async () => {
      setLoading(true);

      const { user } = await getSessionUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      /**
       * IMPORTANT:
       * No routing here anymore.
       * Dashboard is now PURE RENDER LAYER.
       */
      setUserData({
        user,
        plan: profileData?.plan,
        subscriptionStatus: profileData?.subscription_status,
      });

      setProfile(profileData);

      setLoading(false);
    };

    init();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-white/60">Loading system...</p>
      </div>
    );
  }

  if (!userData?.user) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-white/60">No session found.</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white px-6 py-10">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-5xl font-light mb-10">
          Welcome, {profile?.display_name || "Entity"}
        </h1>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="border border-white/10 rounded-2xl p-6">
            <p className="text-white/40 mb-2">Plan</p>
            <h2 className="text-2xl capitalize">
              {userData?.plan || "none"}
            </h2>
          </div>

          <div className="border border-white/10 rounded-2xl p-6">
            <p className="text-white/40 mb-2">Status</p>
            <h2 className="text-2xl capitalize">
              {userData?.subscriptionStatus || "inactive"}
            </h2>
          </div>
        </div>
      </div>
    </main>
  );
}