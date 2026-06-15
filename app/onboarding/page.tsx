"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import PageContainer from "@/components/ui/PageContainer";
import Card from "@/components/ui/Card";
import { Checkbox, Field, Form, SubmitButton, TextInput } from "@/components/ui/forms";

export default function OnboardingPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [entityName, setEntityName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

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
        setMessage("Profile setup could not be loaded. Please retry.");
        setLoading(false);
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
          setMessage("Profile setup could not be created. Please retry.");
          setLoading(false);
          return;
        }
      }

      setLoading(false);
    };

    init();
  }, [router]);

  async function handleCompleteOnboarding() {
    if (!userId) return;
    if (!acknowledged) {
      setMessage("Confirm the health intelligence acknowledgement to continue.");
      return;
    }

    try {
      setSaving(true);
      setMessage(null);

      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName || "You",
          entity_name: entityName || "Personal",
          onboarding_completed: true,
          entity_state: "active",
          life_stage: "initialized",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (error) {
        console.error(error);
        setMessage("Failed to save onboarding. Please try again.");
        return;
      }

      router.replace("/assessment");
    } catch (err) {
      console.error(err);
      setMessage("Onboarding failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-sm text-white/50">Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <section className="pt-24 pb-16">
        <PageContainer>
          <div className="mx-auto max-w-4xl text-center">
            <p className="mb-8 text-eyebrow">
              Welcome
            </p>
            <h1 className="text-5xl font-light leading-[1.04] tracking-tight md:text-6xl">
              Create your
              <br />
              longevity profile
            </h1>
            <p className="mx-auto mt-8 max-w-2xl text-xl text-white/60">
              Set up the basics of your profile to get started.
            </p>
          </div>
        </PageContainer>
      </section>

      <section className="pb-24">
        <PageContainer>
          <div className="max-w-2xl mx-auto">
            <Card className="p-10" hover={false} glow>
              <Form onSubmit={handleCompleteOnboarding} className="space-y-6">
                {message && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm leading-6 text-red-200/80">
                    {message}
                  </div>
                )}
                <Field label="Display Name">
                  <TextInput
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="John Smith"
                    className="h-12 bg-black/30 px-4"
                  />
                </Field>
                <Field label="Profile Name">
                  <TextInput
                    value={entityName}
                    onChange={(e) => setEntityName(e.target.value)}
                    placeholder="e.g. Personal"
                    className="h-12 bg-black/30 px-4"
                  />
                </Field>
                <Checkbox
                  checked={acknowledged}
                  onChange={setAcknowledged}
                  label="I understand Aeonvera provides health intelligence, not emergency medical care."
                />
                <SubmitButton loading={saving}>Complete Setup</SubmitButton>
              </Form>
            </Card>
          </div>
        </PageContainer>
      </section>
    </div>
  );
}
