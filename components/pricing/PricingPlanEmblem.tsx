type PlanId = "core" | "elite" | "sovereign";

type PricingPlanEmblemProps = {
  plan: PlanId;
};

export function PricingPlanEmblem({ plan }: PricingPlanEmblemProps) {
  if (plan === "elite") {
    return (
      <span className="aeon-apple-plan-emblem aeon-apple-plan-emblem-elite" aria-hidden="true">
        <svg viewBox="0 0 64 64" focusable="false">
          <path d="M32 5 55 18.5v27L32 59 9 45.5v-27L32 5Z" />
          <path d="M32 12 49 22v20L32 52 15 42V22l17-10Z" />
          <path d="M32 19.5 42.5 25.6v12.8L32 44.5l-10.5-6.1V25.6L32 19.5Z" />
          <path d="M32 12v7.5M49 22l-6.5 3.6M49 42l-6.5-3.6M32 52v-7.5M15 42l6.5-3.6M15 22l6.5 3.6" />
        </svg>
      </span>
    );
  }

  if (plan === "sovereign") {
    return (
      <span className="aeon-apple-plan-emblem aeon-apple-plan-emblem-sovereign" aria-hidden="true">
        <svg viewBox="0 0 64 64" focusable="false">
          <circle cx="32" cy="32" r="26.5" />
          <path d="M32 7 53.7 19.5v25L32 57 10.3 44.5v-25L32 7Z" />
          <path d="M32 15.5 46.4 23.8v16.4L32 48.5l-14.4-8.3V23.8L32 15.5Z" />
          <path d="M21.2 34.2 27.1 29l4.9-9 4.9 9 5.9 5.2-6.9 1.2L32 44l-3.9-8.6-6.9-1.2Z" />
          <path d="M24.5 20.2 32 16l7.5 4.2M22.6 44.1 32 49.4l9.4-5.3" />
        </svg>
      </span>
    );
  }

  return (
    <span className="aeon-apple-plan-emblem aeon-apple-plan-emblem-core" aria-hidden="true">
      <svg viewBox="0 0 64 64" focusable="false">
        <path d="M32 8.5 52.4 20.2v23.6L32 55.5 11.6 43.8V20.2L32 8.5Z" />
        <path d="M32 17.5 44.6 24.8v14.4L32 46.5l-12.6-7.3V24.8L32 17.5Z" />
      </svg>
    </span>
  );
}
