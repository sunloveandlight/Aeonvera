"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function OnboardingPage() {
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [entityName, setEntityName] = useState("");
  const [lifeFocus, setLifeFocus] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleActivation() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("No authenticated user found.");
        return;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          display_name: displayName,
          entity_name: entityName,
          life_stage: lifeFocus,
          entity_state: "active",
          onboarding_completed: true,
          last_entity_sync: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-xl border border-white/10 rounded-3xl p-10 bg-white/5 backdrop-blur-xl">
        <div className="mb-10">
          <p className="text-sm uppercase tracking-[0.3em] text-white/40 mb-4">
            AEONVERA ENTITY ACTIVATION
          </p>

          <h1 className="text-5xl font-light mb-4 leading-tight">
            Initialize Your
            <br />
            Lifeline Entity
          </h1>

          <p className="text-white/60 text-lg">
            Your entity will begin constructing your long-term trajectory model.
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm text-white/50 mb-2">
              Display Name
            </label>

            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your identity"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 outline-none focus:border-white/30"
            />
          </div>

          <div>
            <label className="block text-sm text-white/50 mb-2">
              Entity Name
            </label>

            <input
              value={entityName}
              onChange={(e) => setEntityName(e.target.value)}
              placeholder="Name your entity"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 outline-none focus:border-white/30"
            />
          </div>

          <div>
            <label className="block text-sm text-white/50 mb-2">
              Current Life Focus
            </label>

            <textarea
              value={lifeFocus}
              onChange={(e) => setLifeFocus(e.target.value)}
              placeholder="Health, longevity, performance, clarity, discipline..."
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 outline-none focus:border-white/30 resize-none"
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleActivation}
            disabled={loading}
            className="w-full bg-white text-black rounded-2xl py-4 font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Activating Entity..." : "Activate Entity"}
          </button>
        </div>
      </div>
    </main>
  );
}