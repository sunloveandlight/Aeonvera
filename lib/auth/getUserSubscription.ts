import { supabase } from "@/lib/supabase/client";

import {
  canAccess,
  Plan,
  SubscriptionStatus,
} from "@/lib/auth/permissions";

export async function getUserSubscription() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      plan: null,
      subscriptionStatus: null,
      allowed: false,
      isPaidUser: false,
    };
  }

  const { data, error } =
    await supabase
      .from("profiles")
      .select(
        `
        plan,
        subscription_status,
        billing_type
      `
      )
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

  const plan = data.plan as Plan;

  const subscriptionStatus =
    data.subscription_status as SubscriptionStatus;

  const allowed = canAccess(
    plan,
    subscriptionStatus,
    "dashboard_access"
  );

  return {
    user,
    plan,
    billingType: data.billing_type,
    subscriptionStatus,
    allowed,
    isPaidUser: !!plan,
  };
}