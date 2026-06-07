"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
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

const steps = ["Basics", "Sleep", "Exercise", "Lifestyle", "Goals"];

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

      const { error } = await supabase
        .from("longevity_assessments")
        .insert([
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
      <Section intensity="high">
        <PageContainer>
          <div className="text-white/30 tracking-[0.3em] text-sm uppercase">
            Initializing Aeonvera systems...
          </div>
        </PageContainer>
      </Section>
    );
  }

  const progress = ((step + 1) / steps.length) * 100;

  return (
    <Section intensity="high">
      <PageContainer className="max-w-3xl">
        <div className="mb-10">
          <p className="text-[10px] uppercase tracking-[0.5em] text-white/25 mb-4">
            Longevity Assessment
          </p>

          <h1 className="text-4xl md:text-5xl font-light tracking-tight text-white/90">
            {steps[step]}
          </h1>

          <p className="text-white/30 mt-2 text-sm tracking-wide">
            Step {step + 1} of {steps.length}
          </p>

          <div className="w-full h-px bg-white/[0.06] mt-6 overflow-hidden">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background:
                  "linear-gradient(to right, rgba(180,140,60,0.6), rgba(212,175,55,0.9))",
              }}
            />
          </div>
        </div>

        <Card className="p-8">
          {step === 0 && (
            <div className="grid md:grid-cols-2 gap-6">
              <Input
                label="Age"
                value={answers.age || ""}
                onChange={(v) => update("age", v)}
              />

              <Input
                label="Sex"
                value={answers.sex || ""}
                onChange={(v) => update("sex", v)}
              />

              <Input
                label="Height (cm)"
                value={answers.height_cm || ""}
                onChange={(v) => update("height_cm", v)}
              />

              <Input
                label="Weight (kg)"
                value={answers.weight_kg || ""}
                onChange={(v) => update("weight_kg", v)}
              />
            </div>
          )}

          {step === 1 && (
            <div className="grid md:grid-cols-2 gap-6">
              <Input
                label="Sleep hours"
                value={answers.sleep_hours || ""}
                onChange={(v) => update("sleep_hours", v)}
              />

              <Input
                label="Sleep quality (1-10)"
                value={answers.sleep_quality || ""}
                onChange={(v) => update("sleep_quality", v)}
              />
            </div>
          )}

          {step === 2 && (
            <div className="grid md:grid-cols-2 gap-6">
              <Input
                label="Exercise days / week"
                value={answers.exercise_days || ""}
                onChange={(v) => update("exercise_days", v)}
              />

              <Input
                label="Strength training (yes / no)"
                value={answers.strength_training || ""}
                onChange={(v) => update("strength_training", v)}
              />
            </div>
          )}

          {step === 3 && (
            <div className="grid md:grid-cols-2 gap-6">
              <Input
                label="Diet type"
                value={answers.diet_type || ""}
                onChange={(v) => update("diet_type", v)}
              />

              <Input
                label="Alcohol use"
                value={answers.alcohol_use || ""}
                onChange={(v) => update("alcohol_use", v)}
              />

              <Input
                label="Smoking"
                value={answers.smoking || ""}
                onChange={(v) => update("smoking", v)}
              />

              <Input
                label="Stress level (1-10)"
                value={answers.stress_level || ""}
                onChange={(v) => update("stress_level", v)}
              />
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

        <div className="flex justify-between mt-8">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="px-6 py-3 rounded-full border border-white/[0.08] text-white/30 hover:text-white/60 hover:border-white/20 transition-all duration-300 text-[11px] uppercase tracking-[0.3em]"
          >
            Back
          </button>

          {step < steps.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="px-6 py-3 rounded-full border border-[rgba(212,175,55,0.3)] text-[rgba(212,175,55,0.8)] hover:border-[rgba(212,175,55,0.6)] hover:text-[rgba(212,175,55,1)] transition-all duration-300 text-[11px] uppercase tracking-[0.3em]"
            >
              Next
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={saving}
              className="px-6 py-3 rounded-full border border-[rgba(212,175,55,0.3)] text-[rgba(212,175,55,0.8)] hover:border-[rgba(212,175,55,0.6)] hover:text-[rgba(212,175,55,1)] transition-all duration-300 text-[11px] uppercase tracking-[0.3em] disabled:opacity-30"
            >
              {saving ? "Saving..." : "Complete Assessment"}
            </button>
          )}
        </div>
      </PageContainer>
    </Section>
  );
}

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
    <div className="flex flex-col">
      <label className="text-[10px] uppercase tracking-[0.35em] text-white/30 mb-3">
        {label}
      </label>

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white/80 placeholder-white/15 focus:outline-none focus:border-[rgba(212,175,55,0.3)] transition-all duration-300 text-sm"
      />
    </div>
  );
}