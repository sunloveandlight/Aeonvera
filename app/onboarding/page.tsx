"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import PageContainer from "@/components/ui/PageContainer";
import Card from "@/components/ui/Card";
import { Checkbox, Field, Form, SubmitButton, TextInput } from "@/components/ui/forms";

const FIRST_WIN_STEPS = [
  {
    title: "Complete the baseline",
    body: "Answer the core assessment so Aeonvera can estimate your biological-age starting point.",
  },
  {
    title: "See the first signal",
    body: "Get a readable baseline with the highest-leverage risk and recovery signals called out.",
  },
  {
    title: "Create one plan",
    body: "Turn the baseline into a simple protocol instead of a long list of disconnected advice.",
  },
  {
    title: "Schedule the next action",
    body: "Move one useful action into your day so the system starts tracking execution.",
  },
];

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
            <h1 className="text-5xl font-semibold leading-[1.04] tracking-tight md:text-6xl">
              Create your
              <br />
              longevity profile
            </h1>
            <p className="mx-auto mt-8 max-w-2xl text-xl text-white/60">
              Set up the basics, then Aeonvera will take you straight into a
              five-minute path: assessment, baseline, plan, and one scheduled
              action.
            </p>
          </div>
        </PageContainer>
      </section>

      <section className="pb-24">
        <PageContainer>
          <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <Card className="p-8" hover={false}>
              <p className="micro-label">First five minutes</p>
              <h2 className="mt-4 text-3xl font-semibold leading-tight text-white">
                Your first win is a baseline and one next action.
              </h2>
              <div className="mt-6 space-y-3">
                {FIRST_WIN_STEPS.map((step, index) => (
                  <div
                    key={step.title}
                    className="grid grid-cols-[auto_1fr] gap-3 rounded-lg border border-white/[0.08] bg-white/[0.025] p-4"
                  >
                    <span className="inline-flex size-7 items-center justify-center rounded-full border border-[rgba(var(--gold),0.24)] text-xs font-semibold text-[rgba(var(--gold),0.86)]">
                      {index + 1}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-white">{step.title}</span>
                      <span className="mt-1 block text-sm leading-6 text-white/48">{step.body}</span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-6 inline-flex items-center gap-2 text-sm text-[rgba(var(--gold),0.82)]">
                Complete setup <ArrowRight size={15} />
              </div>
            </Card>

          <div>
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
          </div>
        </PageContainer>
      </section>
    </div>
  );
}
