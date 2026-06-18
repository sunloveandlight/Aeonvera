"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import PageContainer from "@/components/ui/PageContainer";
import {
  Field as FormField,
  NumberInput,
  RadioGroup,
  SearchInput,
  Select as FormSelect,
  Textarea,
} from "@/components/ui/forms";

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
  type: "number" | "select" | "text" | "textarea";
  placeholder?: string;
  options?: { label: string; value: string }[];
  unit?: string;
  optional?: boolean;
};

type SavedAssessment = Answers & {
  created_at?: string;
};

type ProfileResult = {
  biological_age: number | null;
};

type LatestReport = {
  risk_score: number | null;
  created_at: string | null;
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
        type: "textarea",
        placeholder: "Vitamin D, magnesium, creatine...",
        optional: true,
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

const OPTIONAL_KEYS = STEPS.flatMap((s) => s.fields.filter((f) => f.optional).map((f) => f.key));

const SUMMARY_FIELDS: Array<{
  label: string;
  fields: Array<keyof Answers>;
}> = [
  { label: "Physical", fields: ["age", "sex", "height_cm", "weight_kg", "body_fat_pct", "waist_cm"] },
  { label: "Sleep", fields: ["sleep_hours", "sleep_quality", "recovery_quality", "screen_time_before_bed"] },
  { label: "Cardio", fields: ["resting_hr", "blood_pressure_systolic", "blood_pressure_diastolic", "vo2_max", "hrv"] },
  { label: "Metabolic", fields: ["fasting_glucose", "hba1c", "ldl", "hdl", "triglycerides", "hscrp"] },
  { label: "Lifestyle", fields: ["exercise_days", "strength_training", "diet_type", "smoking", "alcohol_use", "primary_goal"] },
];

function isAssessmentComplete(values: Answers) {
  return REQUIRED_FIELDS.every((key) => values[key]?.trim());
}

function assessmentAccuracy(values: Answers) {
  const filledOptional = OPTIONAL_KEYS.filter((key) => values[key]?.trim()).length;
  return Math.min(100, 40 + Math.round((filledOptional / OPTIONAL_KEYS.length) * 60));
}

function firstIncompleteStep(values: Answers) {
  const missingKey = REQUIRED_FIELDS.find((key) => !values[key]?.trim());
  if (!missingKey) return 0;
  const index = STEPS.findIndex((stepItem) =>
    stepItem.fields.some((field) => field.key === missingKey)
  );
  return Math.max(0, index);
}

function fieldLabel(key: keyof Answers) {
  return STEPS.flatMap((stepItem) => stepItem.fields).find((field) => field.key === key)?.label || key;
}

function displayValue(key: keyof Answers, value?: string) {
  if (!value) return null;
  const field = STEPS.flatMap((stepItem) => stepItem.fields).find((item) => item.key === key);
  const optionLabel = field?.options?.find((option) => option.value === value)?.label;
  return `${optionLabel || value}${field?.unit ? ` ${field.unit}` : ""}`;
}

function sanitizeAnswers(values: Answers) {
  const payload: Answers = {};
  for (const field of STEPS.flatMap((stepItem) => stepItem.fields)) {
    const value = values[field.key];
    if (value != null && value.trim() !== "") {
      payload[field.key] = value;
    }
  }
  return payload;
}

export default function AssessmentPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("");
  const [answers, setAnswers] = useState<Answers>({});
  const [savedAssessment, setSavedAssessment] = useState<SavedAssessment | null>(null);
  const [showForm, setShowForm] = useState(true);
  const [profileResult, setProfileResult] = useState<ProfileResult | null>(null);
  const [latestReport, setLatestReport] = useState<LatestReport | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [summarySearch, setSummarySearch] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      setUserId(user.id);

      const [assessmentRes, profileRes, reportRes] = await Promise.all([
        supabase
          .from("longevity_assessments")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("biological_age")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("longevity_reports")
          .select("risk_score, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (profileRes.data) setProfileResult(profileRes.data);
      if (reportRes.data) setLatestReport(reportRes.data);

      if (assessmentRes.data) {
        const loaded = assessmentRes.data as SavedAssessment;
        setSavedAssessment(loaded);
        setAnswers(loaded);

        if (isAssessmentComplete(loaded)) {
          setShowForm(false);
        } else {
          setStep(firstIncompleteStep(loaded));
          setShowForm(true);
        }
      }

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
        .insert([{ user_id: userId, ...sanitizeAnswers(answers) }]);

      if (insertError) {
        setValidationError("Failed to save. Please try again.");
        setProcessing(false);
        return;
      }

      void fetch("/api/memory/semantic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sourceType: "assessment",
          title: "Longevity assessment baseline",
          content: `Assessment answers:\n${JSON.stringify(sanitizeAnswers(answers), null, 2)}`,
          importance: 0.82,
          metadata: {
            answerCount: Object.values(sanitizeAnswers(answers)).filter(Boolean).length,
            storedBy: "assessment_submit",
          },
        }),
      }).catch(() => null);

      setProcessingStatus("Computing your biological age across all domains...");

      await fetch("/api/longevity/biological-age", {
        method: "POST",
        credentials: "include",
      });

      setProcessingStatus("Biological age ready. Opening your dashboard...");
      router.replace("/dashboard?firstReport=1");
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
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/20 mb-10">
            AEONVERA
          </p>

          <div className="flex justify-center mb-10">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 rounded-full border border-white/[0.06]" />
              <div className="absolute inset-0 rounded-full border-t royal-border animate-spin" />
              <div className="absolute inset-4 rounded-full border border-white/[0.04]" />
              <div
                className="absolute inset-4 rounded-full border-t royal-border animate-spin"
                style={{ animationDuration: "1.5s" }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-[rgb(var(--gold))]" />
              </div>
            </div>
          </div>

          <h2 className="text-3xl font-light tracking-tight text-white/80 mb-4">
            Building Your Biological Profile
          </h2>

          <p className="text-white/30 text-sm leading-relaxed">
            {processingStatus}
          </p>

          <div className="mt-8 flex justify-center gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-1 h-1 rounded-full bg-white/10 animate-pulse"
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
        <div className="w-6 h-6 rounded-full border-t royal-border animate-spin" />
      </div>
    );
  }

  const currentStep = STEPS[step];
  const progress = ((step + 1) / STEPS.length) * 100;

  // Compute live completion percentage
  const completionPct = assessmentAccuracy(answers);
  const requiredComplete = isAssessmentComplete(answers);
  const normalizedSummarySearch = summarySearch.trim().toLowerCase();

  if (!showForm && requiredComplete) {
    const visibleSummaryGroups = SUMMARY_FIELDS.map((group) => ({
      ...group,
      fields: group.fields.filter((key) => {
        if (!normalizedSummarySearch) return true;
        return (
          group.label.toLowerCase().includes(normalizedSummarySearch) ||
          fieldLabel(key).toLowerCase().includes(normalizedSummarySearch) ||
          String(displayValue(key, answers[key]) || "")
            .toLowerCase()
            .includes(normalizedSummarySearch)
        );
      }),
    })).filter((group) => group.fields.length > 0);

    return (
      <div className="min-h-screen py-16">
        <PageContainer className="max-w-6xl">
          <div className="space-y-6">
            <div className="executive-panel rounded-lg p-6 md:p-8">
              <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="micro-label mb-4">Longevity Assessment</p>
                  <h1 className="tracking-tight text-white/90 text-5xl md:text-6xl font-semibold">
                    Your assessment is complete.
                  </h1>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-white/45">
                    Your saved profile is active. Review your inputs, update anything that changed,
                    or return to the dashboard to generate fresh intelligence.
                  </p>
                  {savedAssessment?.created_at && (
                    <p className="mt-4 text-[10px] uppercase tracking-[0.14em] text-white/30">
                      Last updated {new Date(savedAssessment.created_at).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3 text-right">
                  <div className="executive-panel-soft rounded-lg p-4">
                    <p className="micro-label mb-2">Bio Age</p>
                    <p className="text-3xl font-light text-white/86">
                      {profileResult?.biological_age ?? "—"}
                    </p>
                  </div>
                  <div className="executive-panel-soft rounded-lg p-4">
                    <p className="micro-label mb-2">Profile completeness</p>
                    <p className="text-3xl font-light text-white/86">{completionPct}%</p>
                  </div>
                  <div className="executive-panel-soft rounded-lg p-4">
                    <p className="micro-label mb-2">Risk</p>
                    <p className="text-3xl font-light text-white/86">
                      {latestReport?.risk_score ?? "—"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3 border-t border-white/[0.06] pt-6 sm:flex-row">
                <button
                  onClick={() => router.push("/dashboard")}
                  className="premium-action inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-medium"
                >
                  Open Dashboard
                </button>
                <button
                  onClick={() => {
                    setStep(0);
                    setShowForm(true);
                  }}
                  className="premium-action-secondary inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-medium"
                >
                  Review or Update
                </button>
              </div>
            </div>

            <SearchInput
              value={summarySearch}
              onChange={(event) => setSummarySearch(event.target.value)}
              onClear={() => setSummarySearch("")}
              placeholder="Search saved assessment"
              className="h-11"
            />

            <div className="grid gap-4 lg:grid-cols-5">
              {visibleSummaryGroups.map((group) => (
                <div key={group.label} className="executive-panel-soft rounded-lg p-5">
                  <p className="micro-label mb-4">{group.label}</p>
                  <div className="space-y-3">
                    {group.fields.map((key) => {
                      const value = displayValue(key, answers[key]);
                      if (!value) return null;
                      return (
                        <div key={key}>
                          <p className="text-[9px] uppercase tracking-[0.14em] text-white/25">
                            {fieldLabel(key)}
                          </p>
                          <p className="mt-1 text-sm leading-5 text-white/70">{value}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </PageContainer>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-16">
      <PageContainer className="max-w-4xl">
        <div className="executive-panel rounded-lg p-6 md:p-8">

        {/* HEADER */}
        <div className="mb-12">
          <p className="micro-label mb-4">
            Longevity Assessment — Step {step + 1} of {STEPS.length}
          </p>

          <h1 className="tracking-tight text-white/90 text-5xl md:text-6xl font-semibold">
            {currentStep.title}
          </h1>

          <p className="mt-4 max-w-2xl text-white/45 text-sm leading-7">
            {currentStep.subtitle}
          </p>

          {/* PROGRESS BAR */}
          <div className="mt-9 space-y-3">
            <div className="flex justify-between micro-label">
              <span>Progress</span>
              <span>Profile completeness {completionPct}%</span>
            </div>
            <div className="w-full h-px bg-white/[0.08] overflow-hidden">
              <div
                className="gold-fill transition-all duration-700"
                style={{ width: `${progress}%` }}
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
                    ? "bg-[rgb(var(--gold))]"
                    : i === step
                    ? "bg-[rgb(var(--gold))]"
                    : "bg-white/[0.08]"
                }`}
                style={{ width: `${100 / STEPS.length - 1}%` }}
              />
            ))}
          </div>
        </div>

        {/* OPTIONAL BADGE */}
        {!currentStep.required && (
          <div className="premium-status mb-6 inline-flex items-center gap-2 rounded-md px-4 py-2">
            <div className="h-1.5 w-1.5 rounded-full bg-white/35" />
            <span className="text-[10px] uppercase tracking-[0.14em] text-white/55">
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
              {field.type === "select" || field.type === "textarea" ? (
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
          <div className="mb-6 px-5 py-3 rounded-lg border border-red-500/20 bg-red-500/[0.06] text-red-400 text-xs tracking-wide">
            {validationError}
          </div>
        )}

        {/* NAVIGATION */}
        <div className="flex justify-between items-center pt-6 border-t border-white/[0.06]">
          <button
            onClick={handleBack}
            disabled={step === 0}
            className="premium-action-secondary px-6 py-3 rounded-md transition-all duration-300 text-[11px] uppercase tracking-[0.14em] disabled:opacity-0"
          >
            Back
          </button>

          <div className="flex items-center gap-4">
            {!currentStep.required && step < STEPS.length - 1 && (
              <button
                onClick={handleNext}
                className="premium-action-ghost text-[10px] uppercase tracking-[0.14em] transition-colors duration-300"
              >
                Skip →
              </button>
            )}

            {step < STEPS.length - 1 ? (
              <button
                onClick={handleNext}
                className="premium-action px-7 py-3 rounded-md transition-all duration-300 text-[11px] uppercase tracking-[0.14em]"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={submit}
                className="premium-action px-8 py-3 rounded-md transition-all duration-300 text-[11px] uppercase tracking-[0.14em]"
              >
                Build my profile
              </button>
            )}
          </div>
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
        <label className="text-[10px] uppercase tracking-[0.14em] text-white/30">
          {field.label}
        </label>
        {field.optional && (
          <span className="text-[9px] uppercase tracking-[0.14em] text-white/15">
            Optional
          </span>
        )}
      </div>
      <div className="relative">
        <NumberInput
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={`assessment-input executive-input w-full rounded-lg pl-4 text-sm ${
            field.unit ? "pr-20" : "pr-4"
          }`}
        />
        {field.unit && (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/35 text-xs">
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
  if (field.key === "sex") {
    return (
      <FormField
        label={field.label}
        required={!field.optional}
        className="gap-2"
      >
        <RadioGroup
          name={field.key}
          value={value}
          onChange={onChange}
          options={field.options || []}
        />
      </FormField>
    );
  }

  if (field.type === "textarea") {
    return (
      <FormField label={field.label} required={!field.optional}>
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          className="executive-input min-h-24 resize-none rounded-lg p-4 text-sm"
        />
      </FormField>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <label className="text-[10px] uppercase tracking-[0.14em] text-white/30">
          {field.label}
        </label>
        {field.optional && (
          <span className="text-[9px] uppercase tracking-[0.14em] text-white/15">
            Optional
          </span>
        )}
      </div>
      <div className="relative">
        <FormSelect
          value={value}
          onChange={(e) => onChange(e.target.value)}
          options={[
            { label: "Select...", value: "" },
            ...(field.options || []),
          ]}
          className="assessment-select executive-input w-full rounded-lg pl-4 pr-12 text-sm appearance-none cursor-pointer"
          style={{ backgroundColor: "rgba(7,7,10,0.95)" }}
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs leading-none text-white/35">
          ↓
        </span>
      </div>
    </div>
  );
}
