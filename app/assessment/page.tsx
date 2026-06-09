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

const REQUIRED_PER_STEP: (keyof Answers)[][] = [
  ["age", "sex", "height_cm", "weight_kg"],
  ["sleep_hours", "sleep_quality"],
  ["exercise_days", "strength_training"],
  ["diet_type", "stress_level"],
  ["primary_goal"],
];

export default function AssessmentPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("");
  const [answers, setAnswers] = useState<Answers>({});
  const [validationError, setValidationError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);
      setLoading(false);
    };

    checkAuth();
  }, [router]);

  function update(field: keyof Answers, value: string) {
    setAnswers((prev) => ({ ...prev, [field]: value }));
    setValidationError(null);
  }

  function validateCurrentStep(): boolean {
    const required = REQUIRED_PER_STEP[step];
    const missing = required.filter(
      (field) => !answers[field] || answers[field]!.trim() === ""
    );

    if (missing.length > 0) {
      setValidationError(
        `Please fill in: ${missing
          .map((f) => f.replace(/_/g, " "))
          .join(", ")}`
      );
      return false;
    }

    setValidationError(null);
    return true;
  }

  function handleNext() {
    if (!validateCurrentStep()) return;
    setStep((s) => s + 1);
  }

  async function submit() {
    if (!validateCurrentStep()) return;
    if (!userId) return;

    try {
      setProcessing(true);
      setProcessingStatus("Saving your assessment...");

      /**
       * STEP 1 — UPSERT ASSESSMENT
       * Deletes old assessment and inserts fresh one
       * so we never accumulate duplicates
       */
      await supabase
        .from("longevity_assessments")
        .delete()
        .eq("user_id", userId);

      const { error: insertError } = await supabase
        .from("longevity_assessments")
        .insert([{ user_id: userId, ...answers }]);

      if (insertError) {
        setValidationError("Failed to save assessment. Please try again.");
        setProcessing(false);
        return;
      }

      /**
       * STEP 2 — COMPUTE BIOLOGICAL AGE
       */
      setProcessingStatus("Computing your biological age...");

      await fetch("/api/longevity/biological-age", {
        method: "POST",
        credentials: "include",
      });

      /**
       * STEP 3 — GENERATE FULL AI REPORT
       */
      setProcessingStatus(
        "Aeonvera is analyzing your complete biological profile..."
      );

      const reportRes = await fetch("/api/longevity/report", {
        method: "POST",
        credentials: "include",
      });

      if (!reportRes.ok) {
        /**
         * Even if report fails, go to dashboard
         * so user isn't stuck
         */
        router.replace("/dashboard");
        return;
      }

      /**
       * STEP 4 — GO STRAIGHT TO REPORT
       */
      setProcessingStatus("Intelligence report ready. Loading...");
      router.replace("/report");
    } catch (err) {
      console.error(err);
      setValidationError("Something went wrong. Please try again.");
      setProcessing(false);
    }
  }

  /**
   * PROCESSING SCREEN
   * Shows while AI is working
   */
  if (processing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="text-center max-w-lg">
          <p className="text-[10px] uppercase tracking-[0.6em] text-white/25 mb-8">
            AEONVERA INTELLIGENCE ENGINE
          </p>

          <div className="flex justify-center mb-10">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border border-white/10" />
              <div className="absolute inset-0 w-20 h-20 rounded-full border-t border-[rgba(212,175,55,0.6)] animate-spin" />
              <div className="absolute inset-3 w-14 h-14 rounded-full border border-white/5" />
              <div
                className="absolute inset-3 w-14 h-14 rounded-full border-t border-[rgba(212,175,55,0.3)] animate-spin"
                style={{ animationDuration: "2s" }}
              />
            </div>
          </div>

          <h2 className="text-3xl font-light tracking-[-0.03em] text-white/80 mb-4">
            Building Your Intelligence Profile
          </h2>

          <p className="text-white/30 text-sm leading-relaxed tracking-wide">
            {processingStatus}
          </p>

          <div className="mt-10 flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1 h-1 rounded-full bg-[rgba(212,175,55,0.4)] animate-pulse"
                style={{ animationDelay: `${i * 0.3}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
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
                placeholder="33"
              />
              <Select
                label="Sex"
                value={answers.sex || ""}
                onChange={(v) => update("sex", v)}
                options={[
                  { label: "Male", value: "male" },
                  { label: "Female", value: "female" },
                  { label: "Other", value: "other" },
                ]}
              />
              <Input
                label="Height (cm)"
                value={answers.height_cm || ""}
                onChange={(v) => update("height_cm", v)}
                placeholder="178"
              />
              <Input
                label="Weight (kg)"
                value={answers.weight_kg || ""}
                onChange={(v) => update("weight_kg", v)}
                placeholder="75"
              />
            </div>
          )}

          {step === 1 && (
            <div className="grid md:grid-cols-2 gap-6">
              <Input
                label="Sleep hours per night"
                value={answers.sleep_hours || ""}
                onChange={(v) => update("sleep_hours", v)}
                placeholder="7"
              />
              <Select
                label="Sleep quality"
                value={answers.sleep_quality || ""}
                onChange={(v) => update("sleep_quality", v)}
                options={[
                  { label: "1 — Very poor", value: "1" },
                  { label: "2", value: "2" },
                  { label: "3", value: "3" },
                  { label: "4", value: "4" },
                  { label: "5 — Average", value: "5" },
                  { label: "6", value: "6" },
                  { label: "7", value: "7" },
                  { label: "8", value: "8" },
                  { label: "9", value: "9" },
                  { label: "10 — Excellent", value: "10" },
                ]}
              />
            </div>
          )}

          {step === 2 && (
            <div className="grid md:grid-cols-2 gap-6">
              <Select
                label="Exercise days per week"
                value={answers.exercise_days || ""}
                onChange={(v) => update("exercise_days", v)}
                options={[
                  { label: "0 — None", value: "0" },
                  { label: "1 day", value: "1" },
                  { label: "2 days", value: "2" },
                  { label: "3 days", value: "3" },
                  { label: "4 days", value: "4" },
                  { label: "5 days", value: "5" },
                  { label: "6 days", value: "6" },
                  { label: "7 days", value: "7" },
                ]}
              />
              <Select
                label="Strength training"
                value={answers.strength_training || ""}
                onChange={(v) => update("strength_training", v)}
                options={[
                  { label: "Yes", value: "yes" },
                  { label: "No", value: "no" },
                ]}
              />
            </div>
          )}

          {step === 3 && (
            <div className="grid md:grid-cols-2 gap-6">
              <Select
                label="Diet type"
                value={answers.diet_type || ""}
                onChange={(v) => update("diet_type", v)}
                options={[
                  { label: "Mediterranean", value: "mediterranean" },
                  { label: "Whole food plant-based", value: "whole food plant-based" },
                  { label: "Paleo", value: "paleo" },
                  { label: "Keto", value: "keto" },
                  { label: "Vegetarian", value: "vegetarian" },
                  { label: "Vegan", value: "vegan" },
                  { label: "Standard / Mixed", value: "standard" },
                  { label: "Fast food / Processed", value: "processed" },
                ]}
              />
              <Select
                label="Alcohol use"
                value={answers.alcohol_use || ""}
                onChange={(v) => update("alcohol_use", v)}
                options={[
                  { label: "Never", value: "never" },
                  { label: "Occasional / Social", value: "occasional" },
                  { label: "Moderate (weekly)", value: "moderate" },
                  { label: "Heavy (daily)", value: "heavy" },
                ]}
              />
              <Select
                label="Smoking"
                value={answers.smoking || ""}
                onChange={(v) => update("smoking", v)}
                options={[
                  { label: "Never", value: "never" },
                  { label: "Former smoker", value: "former" },
                  { label: "Occasional", value: "occasional" },
                  { label: "Current / Daily", value: "daily" },
                ]}
              />
              <Select
                label="Stress level"
                value={answers.stress_level || ""}
                onChange={(v) => update("stress_level", v)}
                options={[
                  { label: "1 — Very low", value: "1" },
                  { label: "2", value: "2" },
                  { label: "3", value: "3" },
                  { label: "4", value: "4" },
                  { label: "5 — Moderate", value: "5" },
                  { label: "6", value: "6" },
                  { label: "7", value: "7" },
                  { label: "8", value: "8" },
                  { label: "9", value: "9" },
                  { label: "10 — Extreme", value: "10" },
                ]}
              />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <Select
                label="Primary longevity goal"
                value={answers.primary_goal || ""}
                onChange={(v) => update("primary_goal", v)}
                options={[
                  {
                    label: "Extend healthy lifespan",
                    value: "extend healthy lifespan",
                  },
                  {
                    label: "Optimize energy and performance",
                    value: "optimize energy and performance",
                  },
                  {
                    label: "Reduce biological age",
                    value: "reduce biological age",
                  },
                  {
                    label: "Improve cardiovascular health",
                    value: "improve cardiovascular health",
                  },
                  {
                    label: "Optimize body composition",
                    value: "optimize body composition",
                  },
                  {
                    label: "Cognitive enhancement",
                    value: "cognitive enhancement",
                  },
                  {
                    label: "Stress resilience and recovery",
                    value: "stress resilience and recovery",
                  },
                  {
                    label: "General health optimization",
                    value: "general health optimization",
                  },
                ]}
              />
              <p className="text-white/20 text-xs leading-relaxed">
                After submission, Aeonvera will immediately analyze your
                complete biological profile and generate your personalized
                intelligence report.
              </p>
            </div>
          )}

          {validationError && (
            <div className="mt-6 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs tracking-wide">
              {validationError}
            </div>
          )}
        </Card>

        <div className="flex justify-between mt-8">
          <button
            onClick={() => {
              setValidationError(null);
              setStep((s) => Math.max(0, s - 1));
            }}
            disabled={step === 0}
            className="px-6 py-3 rounded-full border border-white/[0.08] text-white/30 hover:text-white/60 hover:border-white/20 transition-all duration-300 text-[11px] uppercase tracking-[0.3em] disabled:opacity-20"
          >
            Back
          </button>

          {step < steps.length - 1 ? (
            <button
              onClick={handleNext}
              className="px-6 py-3 rounded-full border border-[rgba(212,175,55,0.3)] text-[rgba(212,175,55,0.8)] hover:border-[rgba(212,175,55,0.6)] hover:text-[rgba(212,175,55,1)] transition-all duration-300 text-[11px] uppercase tracking-[0.3em]"
            >
              Next
            </button>
          ) : (
            <button
              onClick={submit}
              className="px-6 py-3 rounded-full border border-[rgba(212,175,55,0.3)] text-[rgba(212,175,55,0.8)] hover:border-[rgba(212,175,55,0.6)] hover:text-[rgba(212,175,55,1)] transition-all duration-300 text-[11px] uppercase tracking-[0.3em]"
            >
              Analyze My Biology
            </button>
          )}
        </div>
      </PageContainer>
    </Section>
  );
}

/**
 * INPUT COMPONENT
 */
function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col">
      <label className="text-[10px] uppercase tracking-[0.35em] text-white/30 mb-3">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white/80 placeholder-white/15 focus:outline-none focus:border-[rgba(212,175,55,0.3)] transition-all duration-300 text-sm"
      />
    </div>
  );
}

/**
 * SELECT COMPONENT
 */
function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <div className="flex flex-col">
      <label className="text-[10px] uppercase tracking-[0.35em] text-white/30 mb-3">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white/80 focus:outline-none focus:border-[rgba(212,175,55,0.3)] transition-all duration-300 text-sm appearance-none"
        style={{ backgroundColor: "rgba(255,255,255,0.03)" }}
      >
        <option value="" className="bg-[#07070a] text-white/40">
          Select...
        </option>
        {options.map((opt) => (
          <option
            key={opt.value}
            value={opt.value}
            className="bg-[#07070a] text-white/80"
          >
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}