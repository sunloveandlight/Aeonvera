"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getUserSubscription } from "@/lib/auth/getUserSubscription";
import { supabase } from "@/lib/supabase/client";

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [userData, setUserData] = useState<any>(null);

  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        const result =
          await getUserSubscription();

        /**
         * NOT LOGGED IN
         */
        if (!result.user) {
          router.replace("/login");
          return;
        }

        /**
         * USER HAS NO SUBSCRIPTION
         */
        if (!result.plan) {
          router.replace("/pricing");
          return;
        }

        /**
         * SUBSCRIPTION NOT ACTIVE
         */
        if (
          result.subscriptionStatus !== "active" &&
          result.subscriptionStatus !== "trialing"
        ) {
          router.replace("/pricing");
          return;
        }

        /**
         * LOAD PROFILE
         */
        const {
          data: profileData,
          error,
        } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", result.user.id)
          .single();

        /**
         * NO PROFILE YET
         */
        if (error || !profileData) {
          router.replace("/onboarding");
          return;
        }

        /**
         * ONBOARDING NOT COMPLETE
         */
        if (
          !profileData.onboarding_completed
        ) {
          router.replace("/onboarding");
          return;
        }

        setUserData(result);

        setProfile(profileData);

      } catch (err) {
        console.error(err);

        router.replace("/login");

      } finally {
        setLoading(false);
      }
    };

    initializeDashboard();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full mx-auto mb-6"></div>

          <p className="text-white/60 tracking-wide">
            Synchronizing Entity...
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white px-6 py-10">
      <div className="max-w-6xl mx-auto">

        <div className="mb-12">
          <p className="uppercase tracking-[0.3em] text-white/30 text-sm mb-4">
            AEONVERA ENTITY SYSTEM
          </p>

          <h1 className="text-6xl font-light leading-tight mb-4">
            Welcome Back,
            <br />
            {profile?.display_name || "Entity"}
          </h1>

          <p className="text-white/50 text-xl max-w-2xl">
            Your lifeline system is active and continuously evolving.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl">
            <p className="text-sm uppercase tracking-[0.25em] text-white/40 mb-6">
              ENTITY CORE
            </p>

            <div className="space-y-5">
              <div>
                <p className="text-white/40 text-sm mb-1">
                  Entity Name
                </p>

                <h2 className="text-3xl font-light">
                  {profile?.entity_name ||
                    "Uninitialized"}
                </h2>
              </div>

              <div>
                <p className="text-white/40 text-sm mb-1">
                  State
                </p>

                <p className="text-xl text-green-400">
                  {profile?.entity_state ||
                    "dormant"}
                </p>
              </div>

              <div>
                <p className="text-white/40 text-sm mb-1">
                  Life Stage
                </p>

                <p className="text-lg text-white/80">
                  {profile?.life_stage ||
                    "initializing"}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl">
            <p className="text-sm uppercase tracking-[0.25em] text-white/40 mb-6">
              SYSTEM ACCESS
            </p>

            <div className="space-y-5">
              <div>
                <p className="text-white/40 text-sm mb-1">
                  Plan
                </p>

                <h2 className="text-3xl font-light capitalize">
                  {userData?.plan}
                </h2>
              </div>

              <div>
                <p className="text-white/40 text-sm mb-1">
                  Subscription
                </p>

                <p className="text-green-400 text-lg capitalize">
                  {userData?.subscriptionStatus}
                </p>
              </div>

              <div>
                <p className="text-white/40 text-sm mb-1">
                  Entity Synchronization
                </p>

                <p className="text-white/80">
                  Active
                </p>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl">
            <p className="text-sm uppercase tracking-[0.25em] text-white/40 mb-6">
              TRAJECTORY ENGINE
            </p>

            <div className="border border-dashed border-white/10 rounded-2xl p-10 text-center">
              <h3 className="text-2xl font-light mb-4">
                Trajectory Modeling Initializing
              </h3>

              <p className="text-white/50 max-w-2xl mx-auto">
                Your entity has begun constructing long-term behavioral,
                biological, and cognitive trajectory systems.
              </p>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}