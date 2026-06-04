"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

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
    } catch (err) {
      console.error(err);
      alert("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        Loading assessment...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-8">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-2xl font-light">
          Longevity Assessment
        </h1>
        <p className="text-white/40 text-sm">
          Step {step + 1} of {steps.length}: {steps[step]}
        </p>

        <div className="w-full h-1 bg-white/10 mt-4 rounded-full overflow-hidden">
          <div
            className="h-full bg-white"
            style={{
              width: `${((step + 1) / steps.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="max-w-xl mx-auto border border-white/10 bg-white/5 rounded-2xl p-6">
        {/* STEP 1 — BASICS */}
        {step === 0 && (
          <div className="space-y-4">
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

        {/* STEP 2 — SLEEP */}
        {step === 1 && (
          <div className="space-y-4">
            <Input
              label="Hours of sleep per night"
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

        {/* STEP 3 — EXERCISE */}
        {step === 2 && (
          <div className="space-y-4">
            <Input
              label="Exercise days per week"
              value={answers.exercise_days || ""}
              onChange={(v) => update("exercise_days", v)}
            />

            <Input
              label="Strength training (yes/no)"
              value={answers.strength_training || ""}
              onChange={(v) => update("strength_training", v)}
            />
          </div>
        )}

        {/* STEP 4 — LIFESTYLE */}
        {step === 3 && (
          <div className="space-y-4">
            <Input
              label="Diet type (e.g. keto, balanced, vegan)"
              value={answers.diet_type || ""}
              onChange={(v) => update("diet_type", v)}
            />

            <Input
              label="Alcohol use (none / light / moderate / heavy)"
              value={answers.alcohol_use || ""}
              onChange={(v) => update("alcohol_use", v)}
            />

            <Input
              label="Smoking (yes/no)"
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

        {/* STEP 5 — GOALS */}
        {step === 4 && (
          <div className="space-y-4">
            <Input
              label="Primary goal (longevity, fat loss, muscle, cognition)"
              value={answers.primary_goal || ""}
              onChange={(v) => update("primary_goal", v)}
            />
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="max-w-xl mx-auto flex justify-between mt-6">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="px-4 py-2 border border-white/20 rounded-lg"
        >
          Back
        </button>

        {step < steps.length - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            className="px-4 py-2 bg-white text-black rounded-lg"
          >
            Next
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 bg-white text-black rounded-lg"
          >
            {saving ? "Saving..." : "Finish Assessment"}
          </button>
        )}
      </div>
    </main>
  );
}

/* ---------------- UI COMPONENT ---------------- */

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
        className="w-full mt-1 px-3 py-2 bg-black border border-white/20 rounded-lg text-white"
      />
    </div>
  );
}