"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import PageContainer from "@/components/ui/PageContainer";

type Answers = {
  // BASICS
  age?: string;
  sex?: string;
  height_cm?: string;
  weight_kg?: string;
  // CARDIOVASCULAR
  resting_hr?: string;
  blood_pressure_systolic?: string;
  blood_pressure_diastolic?: string;
  vo2_max?: string;
  hrv?: string;
  // METABOLIC
  fasting_glucose?: string;
  hba1c?: string;
  total_cholesterol?: string;
  ldl?: string;
  hdl?: string;
  triglycerides?: string;
  fasting_insulin?: string;
  hscrp?: string;
  // BODY
  body_fat_pct?: string;
  waist_cm?: string;
  // SLEEP
  sleep_hours?: string;
  sleep_quality?: string;
  recovery_quality?: string;
  screen_time_before_bed?: string;
  // EXERCISE
  exercise_days?: string;
  strength_training?: string;
  // LIFESTYLE
  diet_type?: string;
  alcohol_use?: string;
  smoking?: string;
  water_intake?: string;
  fasting_type?: string;
  supplements?: string;
  sunlight_hours?: string;
  cold_exposure?: string;
  // MENTAL
  stress_level?: string;
  anxiety_level?: string;
  social_connection?: string;
  purpose_score?: string;
  cognitive_score?: string;
  // HORMONES
  testosterone?: string;
  cortisol?: string;
  // FAMILY
  family_heart_disease?: string;
  family_cancer?: string;
  family_diabetes?: string;
  family_longevity?: string;
  // GOAL
  primary_goal?: string;
};

type Step = {
  id: string;
  title: string;
  subtitle: string;
  required: boolean;
  fields: Field[];
};

type Field = {
  key: keyof Answers;
  label: string;
  type: "number" | "select" | "text";
  placeholder?: string;
  options?: { label: string; value: string }[];
  unit?: string;
  optional?: boolean;
};

const STEPS: Step[] = [
  {
    id: "basics",
    title: "Physical Profile",
    subtitle: "Core biometric data required for all calculations.",
    required: true,
    fields: [
      {
        key: "age",
        label: "Age",
        type: "number",
        placeholder: "33",
        unit: "years",
      },
      {
        key: "sex",
        label: "Biological Sex",
        type: "select",
        options: [
          { label: "Male", value: "male" },
          { label: "Female", value: "female" },
          { label: "Other", value: "other" },
        ],
      },
      {
        key: "height_cm",
        label: "Height",
        type: "number",
        placeholder: "178",
        unit: "cm",
      },
      {
        key: "weight_kg",
        label: "Weight",
        type: "number",
        placeholder: "75",
        unit: "kg",
      },
      {
        key: "body_fat_pct",
        label: "Body Fat %",
        type: "number",
        placeholder: "18",
        unit: "%",
        optional: true,
      },
      {
        key: "waist_cm",
        label: "Waist Circumference",
        type: "number",
        placeholder: "82",
        unit: "cm",
        optional: true,
      },
    ],
  },
  {
    id: "cardiovascular",
    title: "Cardiovascular Health",
    subtitle:
      "Optional but highly accurate. Check your last blood pressure reading or wearable data.",
    required: false,
    fields: [
      {
        key: "resting_hr",
        label: "Resting Heart Rate",
        type: "number",
        placeholder: "60",
        unit: "bpm",
        optional: true,
      },
      {
        key: "blood_pressure_systolic",
        label: "Blood Pressure — Systolic",
        type: "number",
        placeholder: "120",
        unit: "mmHg",
        optional: true,
      },
      {
        key: "blood_pressure_diastolic",
        label: "Blood Pressure — Diastolic",
        type: "number",
        placeholder: "80",
        unit: "mmHg",
        optional: true,
      },
      {
        key: "vo2_max",
        label: "VO2 Max",
        type: "number",
        placeholder: "45",
        unit: "ml/kg/min",
        optional: true,
      },
      {
        key: "hrv",
        label: "Heart Rate Variability (HRV)",
        type: "number",
        placeholder: "55",
        unit: "ms",
        optional: true,
      },
    ],
  },
  {
    id: "metabolic",
    title: "Metabolic & Lab Results",
    subtitle:
      "Enter your most recent bloodwork. Even partial data significantly improves accuracy.",
    required: false,
    fields: [
      {
        key: "fasting_glucose",
        label: "Fasting Glucose",
        type: "number",
        placeholder: "85",
        unit: "mg/dL",
        optional: true,
      },
      {
        key: "hba1c",
        label: "HbA1c",
        type: "number",
        placeholder: "5.2",
        unit: "%",
        optional: true,
      },
      {
        key: "ldl",
        label: "LDL Cholesterol",
        type: "number",
        placeholder: "90",
        unit: "mg/dL",
        optional: true,
      },
      {
        key: "hdl",
        label: "HDL Cholesterol",
        type: "number",
        placeholder: "65",
        unit: "mg/dL",
        optional: true,
      },
      {
        key: "triglycerides",
        label: "Triglycerides",
        type: "number",
        placeholder: "90",
        unit: "mg/dL",
        optional: true,
      },
      {
        key: "fasting_insulin",
        label: "Fasting Insulin",
        type: "number",
        placeholder: "6",
        unit: "μIU/mL",
        optional: true,
      },
      {
        key: "hscrp",
        label: "hsCRP (Inflammation)",
        type: "number",
        placeholder: "0.8",
        unit: "mg/L",
        optional: true,
      },
      {
        key: "testosterone",
        label: "Testosterone",
        type: "number",
        placeholder: "600",
        unit: "ng/dL",
        optional: true,
      },
    ],
  },
  {
    id: "sleep",
    title: "Sleep & Recovery",
    subtitle: "Sleep is the most powerful recovery tool available to the body.",
    required: true,
    fields: [
      {
        key: "sleep_hours",
        label: "Average Sleep Duration",
        type: "number",
        placeholder: "7.5",
        unit: "hours",
      },
      {
        key: "sleep_quality",
        label: "Sleep Quality",
        type: "select",
        options: Array.from({ length: 10 }, (_, i) => ({
          label: `${i + 1}${i === 0 ? " — Very poor" : i === 4 ? " — Average" : i === 9 ? " — Excellent" : ""}`,
          value: String(i + 1),
        })),
      },
      {
        key: "recovery_quality",
        label: "Recovery Quality",
        type: "select",
        optional: true,
        options: Array.from({ length: 10 }, (_, i) => ({
          label: `${i + 1}${i === 0 ? " — Very poor" : i === 4 ? " — Average" : i === 9 ? " — Excellent" : ""}`,
          value: String(i + 1),
        })),
      },
      {
        key: "screen_time_before_bed",
        label: "Screen Time Before Bed",
        type: "select",
        optional: true,
        options: [
          { label: "None", value: "none" },
          { label: "Less than 30 minutes", value: "30 minutes" },
          { label: "1 hour", value: "1 hour" },
          { label: "2+ hours", value: "2 hours or more" },
        ],
      },
    ],
  },
  {
    id: "exercise",
    title: "Exercise & Movement",
    subtitle:
      "Physical activity is the closest thing to a longevity drug that exists.",
    required: true,
    fields: [
      {
        key: "exercise_days",
        label: "Exercise Days Per Week",
        type: "select",
        options: Array.from({ length: 8 }, (_, i) => ({
          label: i === 0 ? "0 — Sedentary" : `${i} day${i > 1 ? "s" : ""}`,
          value: String(i),
        })),
      },
      {
        key: "strength_training",
        label: "Strength / Resistance Training",
        type: "select",
        options: [
          { label: "Yes — regular resistance training", value: "yes" },
          { label: "No — cardio only or none", value: "no" },
        ],
      },
    ],
  },
  {
    id: "lifestyle",
    title: "Nutrition & Lifestyle",
    subtitle:
      "Daily habits compound over decades. These factors have major biological impact.",
    required: true,
    fields: [
      {
        key: "diet_type",
        label: "Primary Diet Style",
        type: "select",
        options: [
          { label: "Mediterranean", value: "mediterranean" },
          { label: "Whole food plant-based", value: "whole food plant-based" },
          { label: "Paleo", value: "paleo" },
          { label: "Keto / Low-carb", value: "keto" },
          { label: "Vegan", value: "vegan" },
          { label: "Vegetarian", value: "vegetarian" },
          { label: "Standard / Mixed", value: "standard" },
          { label: "Processed / Fast food dominant", value: "processed" },
        ],
      },
      {
        key: "smoking",
        label: "Smoking Status",
        type: "select",
        options: [
          { label: "Never smoked", value: "never" },
          { label: "Former smoker (quit)", value: "former" },
          { label: "Occasional / Social", value: "occasional" },
          { label: "Current / Daily smoker", value: "daily" },
        ],
      },
      {
        key: "alcohol_use",
        label: "Alcohol Consumption",
        type: "select",
        options: [
          { label: "Never", value: "never" },
          { label: "Occasional / Social (1-2x/month)", value: "occasional" },
          { label: "Moderate (weekly)", value: "moderate" },
          { label: "Heavy (daily or near-daily)", value: "heavy" },
        ],
      },
      {
        key: "water_intake",
        label: "Daily Water Intake",
        type: "select",
        optional: true,
        options: [
          { label: "Rarely drink water", value: "very low" },
          { label: "1-2 liters", value: "1 to 2 liters" },
          { label: "2-3 liters", value: "2 to 3 liters" },
          { label: "3+ liters (optimal)", value: "3 liters or more" },
        ],
      },
      {
        key: "fasting_type",
        label: "Fasting Protocol",
        type: "select",
        optional: true,
        options: [
          { label: "None", value: "none" },
          { label: "16:8 Intermittent fasting", value: "16:8 intermittent" },
          { label: "5:2 (two fasting days/week)", value: "5:2" },
          { label: "24-hour fasts", value: "24 hour" },
          { label: "Extended fasting (multi-day)", value: "extended multi-day" },
        ],
      },
      {
        key: "sunlight_hours",
        label: "Daily Sunlight Exposure",
        type: "select",
        optional: true,
        options: [
          { label: "Rarely / None", value: "rarely none" },
          { label: "Less than 30 minutes", value: "less than 30 minutes" },
          { label: "1-2 hours", value: "1 to 2 hours" },
          { label: "3+ hours", value: "3 or more hours" },
        ],
      },
      {
        key: "supplements",
        label: "Key Supplements",
        type: "select",
        optional: true,
        options: [
          { label: "None", value: "none" },
          { label: "Basic (Vitamin D, Omega-3, Magnesium)", value: "vitamin d omega magnesium" },
          { label: "Advanced (Creatine, NMN, Resveratrol)", value: "creatine nmn resveratrol" },
          { label: "Comprehensive longevity stack", value: "nmn nad resveratrol rapamycin" },
        ],
      },
    ],
  },
  {
    id: "mental",
    title: "Mental & Cognitive Health",
    subtitle:
      "Psychological wellbeing is a direct biological aging factor — not just quality of life.",
    required: true,
    fields: [
      {
        key: "stress_level",
        label: "Chronic Stress Level",
        type: "select",
        options: Array.from({ length: 10 }, (_, i) => ({
          label: `${i + 1}${i === 0 ? " — None" : i === 4 ? " — Moderate" : i === 9 ? " — Extreme" : ""}`,
          value: String(i + 1),
        })),
      },
      {
        key: "anxiety_level",
        label: "Anxiety Level",
        type: "select",
        optional: true,
        options: Array.from({ length: 10 }, (_, i) => ({
          label: `${i + 1}${i === 0 ? " — None" : i === 4 ? " — Moderate" : i === 9 ? " — Severe" : ""}`,
          value: String(i + 1),
        })),
      },
      {
        key: "social_connection",
        label: "Social Connection Quality",
        type: "select",
        optional: true,
        options: Array.from({ length: 10 }, (_, i) => ({
          label: `${i + 1}${i === 0 ? " — Isolated" : i === 4 ? " — Moderate" : i === 9 ? " — Deeply connected" : ""}`,
          value: String(i + 1),
        })),
      },
      {
        key: "purpose_score",
        label: "Sense of Purpose / Meaning",
        type: "select",
        optional: true,
        options: Array.from({ length: 10 }, (_, i) => ({
          label: `${i + 1}${i === 0 ? " — None" : i === 4 ? " — Moderate" : i === 9 ? " — Very strong" : ""}`,
          value: String(i + 1),
        })),
      },
    ],
  },
  {
    id: "family",
    title: "Family History",
    subtitle:
      "Genetics account for roughly 25% of longevity. The other 75% is lifestyle.",
    required: false,
    fields: [
      {
        key: "family_longevity",
        label: "Family Longevity Pattern",
        type: "select",
        optional: true,
        options: [
          { label: "Multiple relatives lived past 90", value: "90 or more" },
          { label: "Most relatives lived into their 80s", value: "80s long" },
          { label: "Most relatives lived into their 70s", value: "70s" },
          { label: "History of early mortality (60s or younger)", value: "60s short" },
          { label: "Unknown", value: "unknown" },
        ],
      },
      {
        key: "family_heart_disease",
        label: "Family History — Heart Disease",
        type: "select",
        optional: true,
        options: [
          { label: "No", value: "no" },
          { label: "Yes", value: "yes" },
          { label: "Unknown", value: "unknown" },
        ],
      },
      {
        key: "family_diabetes",
        label: "Family History — Diabetes",
        type: "select",
        optional: true,
        options: [
          { label: "No", value: "no" },
          { label: "Yes", value: "yes" },
          { label: "Unknown", value: "unknown" },
        ],
      },
      {
        key: "family_cancer",
        label: "Family History — Cancer",
        type: "select",
        optional: true,
        options: [
          { label: "No", value: "no" },
          { label: "Yes", value: "yes" },
          { label: "Unknown", value: "unknown" },
        ],
      },
    ],
  },
  {
    id: "goal",
    title: "Your Longevity Goal",
    subtitle:
      "Your AI coach will personalize every recommendation around this objective.",
    required: true,
    fields: [
      {
        key: "primary_goal",
        label: "Primary Optimization Target",
        type: "select",
        options: [
          { label: "Extend healthy lifespan", value: "extend healthy lifespan" },
          { label: "Reduce biological age", value: "reduce biological age" },
          { label: "Optimize energy and performance", value: "optimize energy and performance" },
          { label: "Improve cardiovascular health", value: "improve cardiovascular health" },
          { label: "Optimize body composition", value: "optimize body composition" },
          { label: "Cognitive enhancement", value: "cognitive enhancement" },
          { label: "Stress resilience and recovery", value: "stress resilience and recovery" },
          { label: "General health optimization", value: "general health optimization" },
        ],
      },
    ],
  },
];

const REQUIRED_FIELDS: (keyof Answers)[] = [
  "age", "sex", "height_cm", "weight_kg",
  "sleep_hours", "sleep_quality",
  "exercise_days", "strength_training",
  "diet_type", "smoking", "alcohol_use",
  "stress_level", "primary_goal",
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
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      setUserId(user.id);
      setLoading(false);
    });
  }, [router]);

  function update(field: keyof Answers, value: string) {
    setAnswers((prev) => ({ ...prev, [field]: value }));
    setValidationError(null);
  }

  function validateStep(): boolean {
    const currentStep = STEPS[step];
    if (!currentStep.required) return true;

    const requiredInStep = currentStep.fields
      .filter((f) => !f.optional && REQUIRED_FIELDS.includes(f.key))
      .map((f) => f.key);

    const missing = requiredInStep.filter(
      (k) => !answers[k] || answers[k]!.trim() === ""
    );

    if (missing.length > 0) {
      setValidationError(
        `Please complete: ${missing
          .map((k) =>
            STEPS[step].fields.find((f) => f.key === k)?.label || k
          )
          .join(", ")}`
      );
      return false;
    }

    setValidationError(null);
    return true;
  }

  function handleNext() {
    if (!validateStep()) return;
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleBack() {
    setValidationError(null);
    setStep((s) => Math.max(0, s - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    if (!validateStep()) return;
    if (!userId) return;

    try {
      setProcessing(true);
      setProcessingStatus("Saving your assessment data...");

      // Delete old assessments — keep only latest
      await supabase
        .from("longevity_assessments")
        .delete()
        .eq("user_id", userId);

      const { error: insertError } = await supabase
        .from("longevity_assessments")
        .insert([{ user_id: userId, ...answers }]);

      if (insertError) {
        setValidationError("Failed to save. Please try again.");
        setProcessing(false);
        return;
      }

      setProcessingStatus("Computing your biological age across all domains...");

      await fetch("/api/longevity/biological-age", {
        method: "POST",
        credentials: "include",
      });

      setProcessingStatus(
        "Aeonvera AI is analyzing your complete biological profile..."
      );

      const reportRes = await fetch("/api/longevity/report", {
        method: "POST",
        credentials: "include",
      });

      if (!reportRes.ok) {
        router.replace("/dashboard");
        return;
      }

      setProcessingStatus("Intelligence report ready.");
      router.replace("/report");
    } catch (err) {
      console.error(err);
      setValidationError("Something went wrong. Please try again.");
      setProcessing(false);
    }
  }

  if (processing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="text-center max-w-lg">
          <p className="text-[10px] uppercase tracking-normal text-white/20 mb-10">
            AEONVERA INTELLIGENCE ENGINE
          </p>

          <div className="flex justify-center mb-10">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 rounded-full border border-white/[0.06]" />
              <div className="absolute inset-0 rounded-full border-t border-[rgba(212,175,55,0.7)] animate-spin" />
              <div className="absolute inset-4 rounded-full border border-white/[0.04]" />
              <div
                className="absolute inset-4 rounded-full border-t border-[rgba(212,175,55,0.4)] animate-spin"
                style={{ animationDuration: "1.5s" }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-[rgba(212,175,55,0.6)]" />
              </div>
            </div>
          </div>

          <h2 className="text-3xl font-light tracking-normal text-white/80 mb-4">
            Building Your Biological Profile
          </h2>

          <p className="text-white/30 text-sm leading-relaxed">
            {processingStatus}
          </p>

          <div className="mt-8 flex justify-center gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-1 h-1 rounded-full bg-[rgba(212,175,55,0.3)] animate-pulse"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-t border-[rgba(212,175,55,0.5)] animate-spin" />
      </div>
    );
  }

  const currentStep = STEPS[step];
  const progress = ((step + 1) / STEPS.length) * 100;

  // Compute live completion percentage
  const filledOptional = Object.keys(answers).filter(
    (k) => !REQUIRED_FIELDS.includes(k as keyof Answers) &&
    answers[k as keyof Answers] &&
    answers[k as keyof Answers]!.trim() !== ""
  ).length;
  const totalOptional = STEPS.flatMap((s) =>
    s.fields.filter((f) => f.optional)
  ).length;
  const completionPct = Math.min(
    100,
    40 + Math.round((filledOptional / totalOptional) * 60)
  );

  return (
    <div className="min-h-screen py-20">
      <PageContainer className="max-w-3xl">

        {/* HEADER */}
        <div className="mb-12">
          <p className="text-[10px] uppercase tracking-normal text-white/20 mb-4">
            Longevity Assessment — Step {step + 1} of {STEPS.length}
          </p>

          <h1 className="text-4xl md:text-5xl font-light tracking-normal text-white/90">
            {currentStep.title}
          </h1>

          <p className="mt-3 text-white/35 text-sm leading-relaxed">
            {currentStep.subtitle}
          </p>

          {/* PROGRESS BAR */}
          <div className="mt-8 space-y-2">
            <div className="flex justify-between text-[10px] uppercase tracking-normal text-white/20">
              <span>Progress</span>
              <span>Accuracy {completionPct}%</span>
            </div>
            <div className="w-full h-px bg-white/[0.06] overflow-hidden">
              <div
                className="h-full transition-all duration-700"
                style={{
                  width: `${progress}%`,
                  background:
                    "linear-gradient(to right, rgba(180,140,60,0.5), rgba(212,175,55,0.9))",
                }}
              />
            </div>
          </div>

          {/* STEP PILLS */}
          <div className="flex gap-2 mt-4 flex-wrap">
            {STEPS.map((s, i) => (
              <div
                key={s.id}
                className={`h-1 rounded-full transition-all duration-500 ${
                  i < step
                    ? "bg-[rgba(212,175,55,0.6)]"
                    : i === step
                    ? "bg-[rgba(212,175,55,0.9)]"
                    : "bg-white/[0.06]"
                }`}
                style={{ width: `${100 / STEPS.length - 1}%` }}
              />
            ))}
          </div>
        </div>

        {/* OPTIONAL BADGE */}
        {!currentStep.required && (
          <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[rgba(212,175,55,0.2)] bg-[rgba(212,175,55,0.05)]">
            <div className="w-1.5 h-1.5 rounded-full bg-[rgba(212,175,55,0.6)]" />
            <span className="text-[10px] uppercase tracking-normal text-[rgba(212,175,55,0.7)]">
              Optional — improves accuracy
            </span>
          </div>
        )}

        {/* FIELDS */}
        <div className="grid md:grid-cols-2 gap-5 mb-8">
          {currentStep.fields.map((field) => (
            <div
              key={field.key}
              className={field.type === "select" && !field.options ? "md:col-span-2" : ""}
            >
              {field.type === "select" ? (
                <SelectField
                  field={field}
                  value={answers[field.key] || ""}
                  onChange={(v) => update(field.key, v)}
                />
              ) : (
                <InputField
                  field={field}
                  value={answers[field.key] || ""}
                  onChange={(v) => update(field.key, v)}
                />
              )}
            </div>
          ))}
        </div>

        {/* VALIDATION ERROR */}
        {validationError && (
          <div className="mb-6 px-5 py-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] text-red-400 text-xs tracking-wide">
            {validationError}
          </div>
        )}

        {/* NAVIGATION */}
        <div className="flex justify-between items-center pt-6 border-t border-white/[0.04]">
          <button
            onClick={handleBack}
            disabled={step === 0}
            className="px-6 py-3 rounded-full border border-white/[0.06] text-white/25 hover:text-white/50 hover:border-white/15 transition-all duration-300 text-[11px] uppercase tracking-normal disabled:opacity-0"
          >
            Back
          </button>

          <div className="flex items-center gap-4">
            {!currentStep.required && step < STEPS.length - 1 && (
              <button
                onClick={handleNext}
                className="text-[10px] uppercase tracking-normal text-white/20 hover:text-white/40 transition-colors duration-300"
              >
                Skip →
              </button>
            )}

            {step < STEPS.length - 1 ? (
              <button
                onClick={handleNext}
                className="px-7 py-3 rounded-full border border-[rgba(212,175,55,0.3)] text-[rgba(212,175,55,0.8)] hover:border-[rgba(212,175,55,0.7)] hover:text-[rgba(212,175,55,1)] transition-all duration-300 text-[11px] uppercase tracking-normal"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={submit}
                className="px-8 py-3 rounded-full border border-[rgba(212,175,55,0.4)] text-[rgba(212,175,55,0.9)] hover:border-[rgba(212,175,55,0.8)] hover:text-[rgba(212,175,55,1)] bg-[rgba(212,175,55,0.06)] transition-all duration-300 text-[11px] uppercase tracking-normal"
              >
                Analyze My Biology
              </button>
            )}
          </div>
        </div>

      </PageContainer>
    </div>
  );
}

function InputField({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <label className="text-[10px] uppercase tracking-normal text-white/30">
          {field.label}
        </label>
        {field.optional && (
          <span className="text-[9px] uppercase tracking-normal text-white/15">
            Optional
          </span>
        )}
      </div>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="w-full px-4 py-3 bg-white/[0.02] border border-white/[0.06] rounded-xl text-white/80 placeholder-white/10 focus:outline-none focus:border-[rgba(212,175,55,0.3)] focus:bg-white/[0.03] transition-all duration-300 text-sm"
        />
        {field.unit && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 text-xs">
            {field.unit}
          </span>
        )}
      </div>
    </div>
  );
}

function SelectField({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <label className="text-[10px] uppercase tracking-normal text-white/30">
          {field.label}
        </label>
        {field.optional && (
          <span className="text-[9px] uppercase tracking-normal text-white/15">
            Optional
          </span>
        )}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 bg-white/[0.02] border border-white/[0.06] rounded-xl text-white/80 focus:outline-none focus:border-[rgba(212,175,55,0.3)] focus:bg-white/[0.03] transition-all duration-300 text-sm appearance-none cursor-pointer"
        style={{ backgroundColor: "rgba(7,7,10,0.95)" }}
      >
        <option value="" className="bg-[#07070a] text-white/30">
          Select...
        </option>
        {field.options?.map((opt) => (
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