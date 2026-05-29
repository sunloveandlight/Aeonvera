"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function OnboardingPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [entityName, setEntityName] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      setUserId(session.user.id);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (profileError) {
        console.error("PROFILE LOOKUP ERROR:", profileError);
        return;
      }

      if (!profile) {
        const { error } = await supabase.from("profiles").insert({
          user_id: session.user.id,
          plan: "free",
          subscription_status: "inactive",
          onboarding_completed: false,
          entity_state: "dormant",
          life_stage: "initializing",
        });

        if (error) {
          console.error("PROFILE INSERT ERROR:", error);
          return;
        }
      }

      setLoading(false);
    };

    init();
  }, [router]);

  async function handleCompleteOnboarding() {
    if (!userId) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName || "Entity",
          entity_name: entityName || "Unnamed Entity",
          onboarding_completed: true,
          entity_state: "active",
          life_stage: "initialized",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (error) {
        console.error("PROFILE UPDATE ERROR:", error);
        alert("Failed to save onboarding.");
        return;
      }

      router.replace("/dashboard");
    } catch (err) {
      console.error(err);
      alert("Onboarding failed.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-white/60">Initializing onboarding...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-lg border border-white/10 rounded-3xl p-10 bg-white/5">
        <h1 className="text-3xl font-light mb-2">
          Initialize Your Entity
        </h1>

        <p className="text-white/50 mb-8">
          Set up your system identity before accessing the dashboard.
        </p>

        <div className="space-y-4">
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Display Name"
            className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-white"
          />

          <input
            value={entityName}
            onChange={(e) => setEntityName(e.target.value)}
            placeholder="Entity Name"
            className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-white"
          />

          <button
            onClick={handleCompleteOnboarding}
            disabled={saving}
            className="w-full bg-white text-black rounded-xl py-3 font-medium hover:bg-gray-200 transition"
          >
            {saving ? "Finalizing..." : "Complete Setup"}
          </button>
        </div>
      </div>
    </main>
  );
}