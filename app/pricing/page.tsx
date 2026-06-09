"use client";

import { useState } from "react";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import PageContainer from "@/components/ui/PageContainer";

type Plan = "core" | "elite" | "sovereign";

const PLANS: Array<{
  id: Plan;
  name: string;
  price: string;
  summary: string;
  features: string[];
  featured?: boolean;
}> = [
  {
    id: "core",
    name: "Core",
    price: "$49",
    summary: "A precise baseline for people starting their longevity work.",
    features: [
      "Biological age computation",
      "Full assessment",
      "AI longevity report",
      "Risk profile analysis",
      "Dashboard access",
    ],
  },
  {
    id: "elite",
    name: "Elite",
    price: "$199",
    summary: "Deeper biomarker intelligence and ongoing optimization.",
    features: [
      "Everything in Core",
      "Advanced biomarker analysis",
      "Proactive AI coaching",
      "Daily intelligence alerts",
      "Priority feature access",
    ],
    featured: true,
  },
  {
    id: "sovereign",
    name: "Sovereign",
    price: "$999",
    summary: "Private health intelligence for executive-level oversight.",
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
    <div>
      <section className="px-6 py-20 lg:px-8">
        <PageContainer>
          <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
            <div>
              <div className="premium-chip mb-5 rounded-full px-3 py-1.5 text-xs">
                <ShieldCheck size={14} className="text-[#d4af37]" />
                Membership
              </div>
              <h1 className="max-w-3xl text-5xl font-semibold leading-[1.04] tracking-normal text-white md:text-7xl">
                Choose the depth of your longevity system.
              </h1>
            </div>
            <p className="max-w-2xl text-lg leading-8 text-white/55">
              Start with a reliable biological age baseline, then move into
              deeper intelligence as your data and goals become more specific.
            </p>
          </div>
        </PageContainer>
      </section>

      <section className="px-6 pb-20 lg:px-8">
        <PageContainer>
          <div className="grid gap-4 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`premium-surface flex min-h-[560px] flex-col rounded-lg p-6 ${
                  plan.featured
                    ? "border-[#d4af37]/40"
                    : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold tracking-normal text-white">
                      {plan.name}
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-white/48">
                      {plan.summary}
                    </p>
                  </div>
                  {plan.featured && (
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-black">
                      Flagship
                    </span>
                  )}
                </div>

                <div className="mt-9">
                  <p className="text-5xl font-semibold tracking-normal text-white">
                    {plan.price}
                    <span className="text-sm font-normal text-white/35"> / month</span>
                  </p>
                </div>

                <div className="mt-8 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-3 text-sm leading-6 text-white/58">
                      <Check size={16} className="mt-1 shrink-0 text-emerald-300/80" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleCheckout(plan.id)}
                  disabled={loadingPlan !== null}
                  className={`mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-45 ${
                    plan.featured
                      ? "premium-button-primary hover:brightness-95"
                      : "premium-button-secondary hover:border-white/25 hover:text-white"
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
