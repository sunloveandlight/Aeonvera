"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import PageContainer from "@/components/ui/PageContainer";
import Card from "@/components/ui/Card";

export default function OnboardingPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [entityName, setEntityName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      /**
       * FIXED: use getUser() instead of getSession()
       * getSession() is spoofable on the client side
       */
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error(profileError);
        return;
      }

      if (!profile) {
        const { error } = await supabase.from("profiles").insert({
          user_id: user.id,
          plan: "free",
          subscription_status: "inactive",
          onboarding_completed: false,
          entity_state: "dormant",
          life_stage: "initializing",
        });

        if (error) {
          console.error(error);
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
        console.error(error);
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
        Initializing...
      </div>
    );
  }

  return (
    <div>
      <section className="pt-32 pb-24">
        <PageContainer>
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-xs uppercase tracking-[0.5em] text-white/40 mb-8">
              Initialization
            </p>
            <h1 className="text-5xl md:text-7xl font-semibold tracking-tight leading-[0.95]">
              Create Your
              <br />
              Longevity Identity
            </h1>
            <p className="mt-8 text-xl text-white/60 max-w-2xl mx-auto">
              Configure the foundation of your biological intelligence system.
            </p>
          </div>
        </PageContainer>
      </section>

      <section className="pb-32">
        <PageContainer>
          <div className="max-w-2xl mx-auto">
            <Card className="p-10">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm text-white/50 mb-3">
                    Display Name
                  </label>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="John Smith"
                    className="w-full h-14 rounded-xl bg-black/50 border border-white/10 px-4 text-white outline-none focus:border-white/30"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/50 mb-3">
                    Entity Name
                  </label>
                  <input
                    value={entityName}
                    onChange={(e) => setEntityName(e.target.value)}
                    placeholder="Aeon Entity Alpha"
                    className="w-full h-14 rounded-xl bg-black/50 border border-white/10 px-4 text-white outline-none focus:border-white/30"
                  />
                </div>
                <button
                  onClick={handleCompleteOnboarding}
                  disabled={saving}
                  className="w-full h-14 rounded-xl bg-white text-black font-medium transition hover:bg-zinc-200 disabled:opacity-50"
                >
                  {saving ? "Initializing..." : "Complete Setup"}
                </button>
              </div>
            </Card>
          </div>
        </PageContainer>
      </section>
    </div>
  );
}