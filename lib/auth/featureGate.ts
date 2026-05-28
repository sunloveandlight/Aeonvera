import {
  Plan,
  SubscriptionStatus,
} from "@/lib/auth/permissions";

export type Feature =
  | "core_features"
  | "elite_features";

export function isFeatureUnlocked(
  plan: Plan | null,
  status: SubscriptionStatus | null,
  feature: Feature
): boolean {
  if (!plan || !status) {
    return false;
  }

  if (
    status !== "active" &&
    status !== "trialing"
  ) {
    return false;
  }

  const hierarchy: Record<Plan, number> = {
    core: 1,
    elite: 2,
  };

  const requiredLevel: Record<
    Feature,
    number
  > = {
    core_features: 1,
    elite_features: 2,
  };

  return (
    hierarchy[plan] >=
    requiredLevel[feature]
  );
}