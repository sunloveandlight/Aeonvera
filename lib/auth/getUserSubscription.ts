import { supabase } from "@/lib/supabase/client";
import {
  canAccess,
  Plan,
  SubscriptionStatus,
} from "@/lib/auth/permissions";

export async function getUserSubscription() {
  // 1. Get logged-in user
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

  // 2. Get profile
  const { data, error } = await supabase
    .from("profiles")
    .select("plan, subscription_status")
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
  const subscriptionStatus = data.subscription_status as SubscriptionStatus;

  const allowed = canAccess(plan, subscriptionStatus, "dashboard_access");

  return {
    user,
    plan,
    subscriptionStatus,
    allowed,
    isPaidUser: plan !== "free" && !!plan,
  };
}