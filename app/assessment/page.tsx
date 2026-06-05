"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

import AppShell from "@/components/layout/AppShell";
import PageContainer from "@/components/ui/PageContainer";
import Section from "@/components/ui/Section";
import Card from "@/components/ui/Card";

type Answers = {
  age?: string;
  sex?: string;
  height_cm?: string;
  weight_kg?: string;

  sleep_hours?: string;
  sleep_quality?: string;

  exercise_days?: string;
  strength_training?: string;

  diet_type?: string;
  alcohol_use?: string;
  smoking?: string;

  stress_level?: string;

  primary_goal?: string;
};

const steps = [
  "Basics",
  "Sleep",
  "Exercise",
  "Lifestyle",
  "Goals",
];

export default function AssessmentPage() {
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [answers, setAnswers] = useState<Answers>({});

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      setLoading(false);
    };

    checkAuth();
  }, [router]);

  function update(field: keyof Answers, value: string) {
    setAnswers((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function submit() {
    try {
      setSaving(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { error } = await supabase.from("longevity_assessments").insert([
        {
          user_id: user.id,
          ...answers,
        },
      ]);

      if (error) {
        console.error(error);
        alert("Failed to save assessment");
        return;
      }

      router.push("/dashboard");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <Section size="lg">
          <PageContainer>
            <div className="text-white/60">
              Initializing Aeonvera systems...
            </div>
          </PageContainer>
        </Section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Section size="lg">
        <PageContainer className="max-w-3xl">

          {/* HEADER */}
          <div className="mb-10">
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
              Longevity Assessment
            </h1>

            <p className="text-white/60 mt-3">
              Step {step + 1} of {steps.length} — {steps[step]}
            </p>

            {/* PROGRESS */}
            <div className="w-full h-1 bg-white/10 mt-5 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all"
                style={{
                  width: `${((step + 1) / steps.length) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* CARD */}
          <Card className="p-8">
            {step === 0 && (
              <div className="grid md:grid-cols-2 gap-6">
                <Input label="Age" value={answers.age || ""} onChange={(v) => update("age", v)} />
                <Input label="Sex" value={answers.sex || ""} onChange={(v) => update("sex", v)} />
                <Input label="Height (cm)" value={answers.height_cm || ""} onChange={(v) => update("height_cm", v)} />
                <Input label="Weight (kg)" value={answers.weight_kg || ""} onChange={(v) => update("weight_kg", v)} />
              </div>
            )}

            {step === 1 && (
              <div className="grid md:grid-cols-2 gap-6">
                <Input label="Sleep hours" value={answers.sleep_hours || ""} onChange={(v) => update("sleep_hours", v)} />
                <Input label="Sleep quality (1-10)" value={answers.sleep_quality || ""} onChange={(v) => update("sleep_quality", v)} />
              </div>
            )}

            {step === 2 && (
              <div className="grid md:grid-cols-2 gap-6">
                <Input label="Exercise days/week" value={answers.exercise_days || ""} onChange={(v) => update("exercise_days", v)} />
                <Input label="Strength training (yes/no)" value={answers.strength_training || ""} onChange={(v) => update("strength_training", v)} />
              </div>
            )}

            {step === 3 && (
              <div className="grid md:grid-cols-2 gap-6">
                <Input label="Diet type" value={answers.diet_type || ""} onChange={(v) => update("diet_type", v)} />
                <Input label="Alcohol use" value={answers.alcohol_use || ""} onChange={(v) => update("alcohol_use", v)} />
                <Input label="Smoking" value={answers.smoking || ""} onChange={(v) => update("smoking", v)} />
                <Input label="Stress level (1-10)" value={answers.stress_level || ""} onChange={(v) => update("stress_level", v)} />
              </div>
            )}

            {step === 4 && (
              <Input
                label="Primary goal"
                value={answers.primary_goal || ""}
                onChange={(v) => update("primary_goal", v)}
              />
            )}
          </Card>

          {/* NAV */}
          <div className="flex justify-between mt-8">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="px-5 py-2 rounded-xl border border-white/10 text-white/70 hover:text-white transition"
            >
              Back
            </button>

            {step < steps.length - 1 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="px-5 py-2 rounded-xl bg-white text-black"
              >
                Next
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-white text-black disabled:opacity-50"
              >
                {saving ? "Saving..." : "Finish Assessment"}
              </button>
            )}
          </div>

        </PageContainer>
      </Section>
    </AppShell>
  );
}

/* INPUT */
function Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-sm text-white/60">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition"
      />
    </div>
  );
}