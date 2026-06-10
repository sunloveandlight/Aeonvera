"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";

export type PricingPlan = {
  id: "core" | "elite" | "sovereign";
  name: string;
  price: string;
  summary: string;
  features: string[];
  depth: string;
  details: {
    label: string;
    items: string[];
  }[];
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
  const [expanded, setExpanded] = useState(false);

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
        <p className="mt-4 text-[10px] uppercase tracking-[0.14em] royal-text">
          {plan.depth}
        </p>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setExpanded((open) => !open);
          }}
          className="mt-4 text-left text-[10px] uppercase tracking-[0.14em] text-white/30 transition hover:text-white/62"
        >
          {expanded ? "Hide details" : "View details"}
        </button>
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

      {expanded && (
        <div className="mt-7 space-y-4 border-t border-white/[0.06] pt-5">
          {plan.details.map((section) => (
            <div key={section.label}>
              <p className="micro-label mb-3">{section.label}</p>
              <div className="space-y-2">
                {section.items.map((item) => (
                  <p key={item} className="text-xs leading-5 text-white/52">
                    {item}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onCheckout(plan.id);
        }}
        disabled={disabled}
        className="premium-action mt-9 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loadingPlan === plan.id ? "Processing..." : `Get ${plan.name}`}
        {loadingPlan !== plan.id && <ArrowRight size={16} />}
      </button>
    </div>
  );
}
