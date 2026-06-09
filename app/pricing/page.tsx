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
    <div className="text-white">
      <section className="px-6 py-24 lg:px-8">
        <PageContainer>
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-sm font-medium text-[#2997ff]">Pricing</p>
            <h1 className="mt-5 text-5xl font-semibold leading-[1.05] md:text-6xl">
              Choose the right level of longevity intelligence.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/55">
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
                    ? "border-[#2997ff]/50 bg-[#151517]"
                    : "border-white/10 bg-[#151517]"
                }`}
              >
                <div className="min-h-[112px]">
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="text-2xl font-semibold">{plan.name}</h2>
                    {plan.recommended && (
                      <span className="shrink-0 rounded-full bg-[#2997ff] px-3 py-1 text-xs font-medium text-white">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="mt-4 text-sm leading-6 text-white/55">
                    {plan.summary}
                  </p>
                </div>

                <p className="mt-8 text-5xl font-semibold">
                  {plan.price}
                  <span className="text-base font-normal text-white/40"> / month</span>
                </p>

                <div className="mt-8 space-y-4">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex gap-3 text-sm leading-6 text-white/70">
                      <Check size={17} className="mt-1 shrink-0 text-white/60" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleCheckout(plan.id)}
                  disabled={loadingPlan !== null}
                  className={`mt-9 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    plan.recommended
                      ? "bg-[#2997ff] text-white hover:bg-[#147ce5]"
                      : "border border-white/15 text-white/80 hover:border-white/30 hover:text-white"
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
