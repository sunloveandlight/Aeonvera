import { NextResponse } from "next/server";

import {
  canAccess,
  FEATURE_ENTITLEMENTS,
  PLAN_LABEL,
  type Feature,
} from "@/lib/auth/permissions";
import { getUserPlanForUsage } from "@/lib/usage/tierUsage";

type SupabaseAdmin = Parameters<typeof getUserPlanForUsage>[0]["supabase"];

export async function requireServerFeatureAccess({
  feature,
  lockedMessage,
  supabase,
  userId,
}: {
  feature: Feature;
  lockedMessage?: string;
  supabase: SupabaseAdmin;
  userId: string;
}) {
  const subscription = await getUserPlanForUsage({ supabase, userId });

  if (canAccess(subscription.plan, subscription.status, feature)) {
    return {
      allowed: true as const,
      subscription,
    };
  }

  const entitlement = FEATURE_ENTITLEMENTS.find((item) => item.feature === feature);
  const minimumPlan = entitlement?.minimumPlan || "core";
  const label = entitlement?.label || "This layer";

  return {
    allowed: false as const,
    response: NextResponse.json(
      {
        error: lockedMessage || `${label} requires an active ${PLAN_LABEL[minimumPlan]} plan.`,
        locked: true,
        upgrade: {
          currentPlan: subscription.plan,
          minimumPlan,
          message:
            entitlement?.description ||
            `Upgrade to ${PLAN_LABEL[minimumPlan]} to unlock this layer.`,
        },
      },
      { status: 403 }
    ),
    subscription,
  };
}
