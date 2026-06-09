"use client";

import { ArrowRight, Check } from "lucide-react";

export type PricingPlan = {
  id: "core" | "elite" | "sovereign";
  name: string;
  price: string;
  summary: string;
  features: string[];
  recommended?: boolean;
};

type PricingPlanCardProps = {
  plan: PricingPlan;
  loadingPlan: PricingPlan["id"] | null;
  onCheckout: (plan: PricingPlan["id"]) => void;
};

export default function PricingPlanCard({
  plan,
  loadingPlan,
  onCheckout,
}: PricingPlanCardProps) {
  const disabled = loadingPlan !== null;

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => {
        if (!disabled) onCheckout(plan.id);
      }}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onCheckout(plan.id);
        }
      }}
      className={`pricing-plan-card flex h-full min-h-[34rem] cursor-pointer flex-col rounded-lg border p-7 ${
        disabled ? "pointer-events-none opacity-60" : ""
      } ${
        plan.recommended
          ? "pricing-plan-card-featured"
          : "border-white/10 bg-[#151517]"
      }`}
    >
      <div className="min-h-[112px]">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-2xl font-light">{plan.name}</h2>
          {plan.recommended && (
            <span className="premium-status shrink-0 rounded-md px-3 py-1 text-xs font-medium">
              Recommended
            </span>
          )}
        </div>
        <p className="mt-4 text-sm leading-6 text-white/55">{plan.summary}</p>
      </div>

      <p className="mt-8 text-5xl font-light">
        {plan.price}
        <span className="text-base font-normal text-white/40"> / month</span>
      </p>

      <div className="mt-8 flex-1 space-y-4">
        {plan.features.map((feature) => (
          <div key={feature} className="flex gap-3 text-sm leading-6 text-white/70">
            <Check size={17} className="mt-1 shrink-0 royal-text" />
            <span>{feature}</span>
          </div>
        ))}
      </div>

      <div className="premium-action mt-9 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50">
        {loadingPlan === plan.id ? "Processing..." : `Get ${plan.name}`}
        {loadingPlan !== plan.id && <ArrowRight size={16} />}
      </div>
    </div>
  );
}
