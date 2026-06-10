"use client";

import { useState } from "react";
import PageContainer from "@/components/ui/PageContainer";
import Page from "@/components/ui/Page";
import Section from "@/components/ui/Section";
import SectionTitle from "@/components/ui/SectionTitle";
import Text from "@/components/ui/Text";
import Motion from "@/components/motion/Motion";
import PricingPlanCard, { type PricingPlan } from "@/components/pricing/PricingPlanCard";

type Plan = "core" | "elite" | "sovereign";

const PLANS: PricingPlan[] = [
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
    depth: "Baseline intelligence",
    details: [
      {
        label: "Function Set",
        items: [
          "One active biological age baseline",
          "Assessment-driven recommendations",
          "Manual Apple Health import",
        ],
      },
      {
        label: "Best For",
        items: [
          "Users starting their first healthspan baseline",
          "Monthly check-ins and simple risk context",
        ],
      },
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
    depth: "Continuous optimization",
    details: [
      {
        label: "Function Set",
        items: [
          "Daily proactive coach contact",
          "Wearable-sync health state updates",
          "Trend-aware sleep, recovery, and activity alerts",
          "Higher-depth report regeneration",
        ],
      },
      {
        label: "Automation",
        items: [
          "Email delivery via coach pipeline",
          "Push registration ready for mobile devices",
          "Behavior memory influences recommendations",
        ],
      },
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
    depth: "Executive digital twin",
    details: [
      {
        label: "Function Set",
        items: [
          "Full digital twin timeline",
          "Physician-ready reporting and exports",
          "Multi-source data ingestion strategy",
          "Advanced scenario simulation readiness",
        ],
      },
      {
        label: "Operating Model",
        items: [
          "Concierge-level data integration",
          "Family/account expansion path",
          "Most complete intervention and longitudinal tracking tier",
        ],
      },
    ],
  },
];

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);

  async function handleCheckout(plan: Plan) {
    try {
      setLoadingPlan(plan);
      setCheckoutMessage(null);

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
      setCheckoutMessage(
        err instanceof Error
          ? err.message
          : "Failed to start checkout. Please try again."
      );
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <Page className="text-white" density="compact">
      <Section className="px-6 lg:px-8" intensity="low">
        <PageContainer>
          <SectionTitle
            eyebrow="Pricing"
            title="Choose the right level of longevity intelligence."
            align="center"
          />
          <Text
            variant="secondary"
            className="mx-auto mt-6 block max-w-2xl text-center text-lg leading-8"
          >
              Start with a reliable baseline. Move into deeper support as your
              data, goals, and decision-making needs grow.
          </Text>
            {checkoutMessage && (
              <div className="mx-auto mt-6 max-w-xl rounded-lg border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm leading-6 text-red-200/80">
                {checkoutMessage}
              </div>
            )}
        </PageContainer>
      </Section>

      <Section className="px-6 pb-24 lg:px-8" intensity="low">
        <PageContainer>
          <div className="grid gap-5 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <Motion key={plan.id} type="rise" className="h-full">
                <PricingPlanCard
                  plan={plan}
                  loadingPlan={loadingPlan}
                  onCheckout={handleCheckout}
                />
              </Motion>
            ))}
          </div>
        </PageContainer>
      </Section>
    </Page>
  );
}
