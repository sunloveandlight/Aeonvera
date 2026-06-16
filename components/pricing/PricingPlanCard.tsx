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
  mode: "purchase" | "current" | "included" | "upgrade" | "manage";
  onSelect: (plan: PricingPlan["id"]) => void;
};

export default function PricingPlanCard({
  plan,
  loadingPlan,
  mode,
  onSelect,
}: PricingPlanCardProps) {
  const disabled = loadingPlan !== null;
  const [expanded, setExpanded] = useState(false);
  const showPrice = mode === "purchase" || mode === "upgrade";
  const isCurrent = mode === "current";
  const visibleFeatures = expanded ? plan.features : plan.features.slice(0, 3);
  const hiddenFeatureCount = Math.max(plan.features.length - visibleFeatures.length, 0);
  const ctaLabel =
    loadingPlan === plan.id
      ? "Opening..."
      : mode === "current"
      ? "Manage current plan"
      : mode === "included"
      ? "Included in your plan"
      : mode === "upgrade"
      ? `Upgrade to ${plan.name}`
      : `Get ${plan.name}`;

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => {
        if (!disabled) onSelect(plan.id);
      }}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(plan.id);
        }
      }}
      className={`pricing-plan-card flex h-full min-h-[31rem] cursor-pointer flex-col rounded-lg border p-7 ${
        disabled ? "pointer-events-none opacity-60" : ""
      } ${
        isCurrent
          ? "pricing-plan-card-current"
          : plan.id === "sovereign"
          ? "pricing-plan-card-sovereign"
          : plan.recommended
          ? "pricing-plan-card-featured"
          : "border-white/10 bg-[#151517]"
      }`}
    >
      <div className="pricing-card-intro">
        <div className="flex min-h-8 items-start justify-between gap-4">
          <h2 className="text-2xl font-light">{plan.name}</h2>
          {plan.recommended && (
            <span className="premium-status pricing-status-featured shrink-0 rounded-md px-3 py-1 text-xs font-medium">
              Recommended
            </span>
          )}
          {plan.id === "sovereign" && !isCurrent && (
            <span className="premium-status premium-status-sovereign shrink-0 rounded-md px-3 py-1 text-xs font-medium">
              Most advanced
            </span>
          )}
          {isCurrent && (
            <span className="premium-status shrink-0 rounded-md px-3 py-1 text-xs font-medium">
              Current
            </span>
          )}
        </div>
        <p className="mt-4 text-sm leading-6 text-white/55">{plan.summary}</p>
        <p className="pricing-card-depth mt-4 text-[10px] uppercase tracking-[0.14em] royal-text">
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
          {expanded ? "Show less" : "Explore details"}
        </button>
      </div>

      <div className="pricing-card-price">
        {showPrice ? (
          <p className="text-5xl font-light">
            {plan.price}
            <span className="text-base font-normal text-white/40"> / month</span>
          </p>
        ) : (
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] royal-text">
              {isCurrent ? "Active membership" : "Already unlocked"}
            </p>
            <p className="mt-3 text-2xl font-light text-white/80">
              {isCurrent ? "Your current tier" : "Included with your tier"}
            </p>
          </div>
        )}
      </div>

      <div className="pricing-card-features">
        {visibleFeatures.map((feature) => (
          <div key={feature} className="flex gap-3 text-sm leading-6 text-white/70">
            <Check size={17} className="mt-1 shrink-0 royal-text" />
            <span>{feature}</span>
          </div>
        ))}
        {!expanded && hiddenFeatureCount > 0 ? (
          <p className="pt-1 text-xs leading-5 text-white/36">
            {hiddenFeatureCount} more capabilities inside.
          </p>
        ) : null}
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
          onSelect(plan.id);
        }}
        disabled={disabled}
        className="premium-action mt-9 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
      >
        {ctaLabel}
        {loadingPlan !== plan.id && <ArrowRight size={16} />}
      </button>
    </div>
  );
}
