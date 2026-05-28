import { supabase } from "@/lib/supabase/client";

import {
  canAccess,
  Plan,
  SubscriptionStatus,
} from "@/lib/auth/permissions";

export async function getUserSubscription() {

  /**
   * FIRST:
   * Get active session directly
   */
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    return {
      user: null,
      plan: null,
      subscriptionStatus: null,
      allowed: false,
      isPaidUser: false,
    };
  }

  /**
   * THEN:
   * Get authenticated user
   */
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

  /**
   * Fetch subscription/profile
   */
  const { data, error } = await supabase
    .from("profiles")
    .select(`
      plan,
      subscription_status,
      onboarding_completed,
      entity_state,
      life_stage
    `)
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    return {
      user,
      plan: null,
      subscriptionStatus: null,
      allowed: false,
      isPaidUser: false,
    };
  }

  const plan =
    data.plan as Plan | null;

  const status =
    data.subscription_status as SubscriptionStatus | null;

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

    isPaidUser: !!plan,
  };
}