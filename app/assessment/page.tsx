"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type FormState = {
  age: string;
  height: string;
  weight: string;
  sleep: string;
  exercise: string;
  stress: string;
  diet: string;
  smoking: string;
  alcohol: string;
};

export default function AssessmentPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    age: "",
    height: "",
    weight: "",
    sleep: "",
    exercise: "",
    stress: "",
    diet: "",
    smoking: "",
    alcohol: "",
  });

  function updateField(field: keyof FormState, value: string) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function handleSubmit() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/longevity/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        throw new Error("Failed to generate report");
      }

      const data = await res.json();

      // optional: store report temporarily
      if (typeof window !== "undefined") {
        localStorage.setItem("latestReport", JSON.stringify(data));
      }

      router.push("/report");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const Input = ({
    label,
    value,
    onChange,
    placeholder,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
  }) => (
    <div className="flex flex-col gap-2">
      <label className="text-sm text-white/70">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30
        focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400/30 transition"
      />
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-[#05060a] text-white relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute inset-0">
        <div className="absolute w-[600px] h-[600px] bg-cyan-500/20 blur-[120px] rounded-full top-[-200px] left-[-200px]" />
        <div className="absolute w-[500px] h-[500px] bg-purple-500/20 blur-[120px] rounded-full bottom-[-200px] right-[-200px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
            Longevity Assessment
          </h1>
          <p className="text-white/60 mt-3">
            A precise signal model for your biological trajectory.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-xl shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Age"
              value={form.age}
              onChange={(v) => updateField("age", v)}
              placeholder="e.g. 29"
            />

            <Input
              label="Height (cm)"
              value={form.height}
              onChange={(v) => updateField("height", v)}
              placeholder="e.g. 178"
            />

            <Input
              label="Weight (kg)"
              value={form.weight}
              onChange={(v) => updateField("weight", v)}
              placeholder="e.g. 72"
            />

            <Input
              label="Sleep (hours avg)"
              value={form.sleep}
              onChange={(v) => updateField("sleep", v)}
              placeholder="e.g. 7"
            />

            <Input
              label="Exercise (days/week)"
              value={form.exercise}
              onChange={(v) => updateField("exercise", v)}
              placeholder="e.g. 3"
            />

            <Input
              label="Stress level (1-10)"
              value={form.stress}
              onChange={(v) => updateField("stress", v)}
              placeholder="e.g. 6"
            />

            <Input
              label="Diet quality"
              value={form.diet}
              onChange={(v) => updateField("diet", v)}
              placeholder="e.g. balanced / average / poor"
            />

            <Input
              label="Smoking"
              value={form.smoking}
              onChange={(v) => updateField("smoking", v)}
              placeholder="yes / no"
            />

            <Input
              label="Alcohol consumption"
              value={form.alcohol}
              onChange={(v) => updateField("alcohol", v)}
              placeholder="none / light / moderate / heavy"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="mt-6 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="mt-10 flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 
              hover:opacity-90 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Generating Report..." : "Generate Longevity Report"}
            </button>
          </div>
        </div>

        {/* Footer hint */}
        <p className="text-white/30 text-xs mt-6 text-center">
          Aeonvera AI models analyze multi-dimensional health signals.
        </p>
      </div>
    </div>
  );
}