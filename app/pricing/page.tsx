"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import PageContainer from "@/components/ui/PageContainer";

type Plan = "core" | "elite" | "sovereign";

const PLANS: Array<{
  id: Plan;
  name: string;
  price: string;
  summary: string;
  features: string[];
  recommended?: boolean;
}> = [
  {
    id: "core",
    name: "Core",
    price: "$49",
    summary: "For establishing a clear longevity baseline.",
    features: [
      "Biological age computation",
      "Full healthspan assessment",
      "AI longevity report",
      "Risk profile analysis",
      "Dashboard access",
    ],
  },
  {
    id: "elite",
    name: "Elite",
    price: "$199",
    summary: "For ongoing optimization with deeper analysis.",
    features: [
      "Everything in Core",
      "Advanced biomarker analysis",
      "Proactive AI coaching",
      "Daily intelligence alerts",
      "Priority feature access",
    ],
    recommended: true,
  },
  {
    id: "sovereign",
    name: "Sovereign",
    price: "$999",
    summary: "For private executive-level health intelligence.",
    features: [
      "Everything in Elite",
      "Unlimited AI analysis",
      "Digital twin modeling",
      "Physician-ready exports",
      "Concierge data integration",
      "Priority support",
    ],
  },
];

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null);

  async function handleCheckout(plan: Plan) {
    try {
      setLoadingPlan(plan);

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Checkout failed");
      }

      window.location.assign(data.url);
    } catch (err) {
      console.error(err);
      alert("Failed to start checkout.");
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <div className="text-[var(--ink)]">
      <section className="px-6 py-24 lg:px-8">
        <PageContainer>
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-sm font-medium royal-text">Pricing</p>
            <h1 className="mt-5 text-5xl font-semibold leading-[1.05] md:text-6xl">
              Choose the right level of longevity intelligence.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[rgba(28,39,51,0.68)]">
              Start with a reliable baseline. Move into deeper support as your
              data, goals, and decision-making needs grow.
            </p>
          </div>
        </PageContainer>
      </section>

      <section className="px-6 pb-24 lg:px-8">
        <PageContainer>
          <div className="grid gap-5 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`rounded-lg border p-7 ${
                  plan.recommended
                    ? "royal-border royal-gradient-soft"
                    : "border-[rgba(36,50,74,0.12)] bg-white/75"
                }`}
              >
                <div className="min-h-[112px]">
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="text-2xl font-semibold">{plan.name}</h2>
                    {plan.recommended && (
                      <span className="shrink-0 rounded-full royal-gradient px-3 py-1 text-xs font-medium text-white">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="mt-4 text-sm leading-6 text-[rgba(38,51,73,0.62)]">
                    {plan.summary}
                  </p>
                </div>

                <p className="mt-8 text-5xl font-semibold">
                  {plan.price}
                  <span className="text-base font-normal text-[rgba(38,51,73,0.46)]"> / month</span>
                </p>

                <div className="mt-8 space-y-4">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex gap-3 text-sm leading-6 text-[rgba(16,24,39,0.72)]">
                      <Check size={17} className="mt-1 shrink-0 text-[rgb(var(--royal))]" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleCheckout(plan.id)}
                  disabled={loadingPlan !== null}
                  className={`mt-9 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    plan.recommended
                      ? "royal-gradient text-white hover:opacity-95"
                      : "border border-[rgba(36,50,74,0.16)] bg-white/60 text-[rgba(16,24,39,0.78)] hover:border-[rgba(55,38,103,0.24)] hover:text-[var(--ink)]"
                  }`}
                >
                  {loadingPlan === plan.id ? "Processing..." : `Get ${plan.name}`}
                  {loadingPlan !== plan.id && <ArrowRight size={16} />}
                </button>
              </div>
            ))}
          </div>
        </PageContainer>
      </section>
    </div>
  );
}
