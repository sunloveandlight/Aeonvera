import { supabase } from "@/lib/supabase/client";

import {
  canAccess,
  Plan,
  SubscriptionStatus,
} from "@/lib/auth/permissions";
import { getWorkspaceSubscriptionForUser } from "@/lib/auth/workspaceSubscription";

export async function getUserSubscription() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      user: null,
      plan: null,
      subscriptionStatus: null,
      allowed: false,
      isPaidUser: false,
    };
  }

  const workspaceSubscription = await getWorkspaceSubscriptionForUser({
    supabase,
    userId: user.id,
  });

  /**
   * Fetch legacy profile context. Workspace billing is allowed to stand on its
   * own so a missing profile row does not hide a valid workspace subscription.
   */
  const { data } = await supabase
    .from("profiles")
    .select(`
      plan,
      subscription_status,
      onboarding_completed,
      entity_state,
      life_stage
    `)
    .eq("user_id", user.id)
    .maybeSingle();

  const plan =
    workspaceSubscription?.plan || ((data?.plan as Plan | null) ?? null);

  const status =
    workspaceSubscription?.status ||
    ((data?.subscription_status as SubscriptionStatus | null) ?? null);

  return {
    user,

    plan,

    subscriptionStatus: status,

    onboardingCompleted:
    data.onboarding_completed,

    entityState:
      data.entity_state,

    lifeStage:
      data.life_stage,

    allowed: canAccess(
      plan,
      status,
      "dashboard_access"
    ),

    isPaidUser: allowedPlan(plan, status),
  };
}

function allowedPlan(plan: Plan | null, status: SubscriptionStatus | null) {
  return canAccess(plan, status, "dashboard_access");
}
