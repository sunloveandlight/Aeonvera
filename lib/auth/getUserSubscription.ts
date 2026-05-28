import { supabase } from "@/lib/supabase/client";
import {
  canAccess,
  Plan,
  SubscriptionStatus,
} from "@/lib/auth/permissions";

export async function getUserSubscription() {
  console.log("CHECKING USER SESSION...");

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  console.log("USER RESULT:", user);

  if (userError) {
    console.error("USER ERROR:", userError);
  }

  if (!user) {
    return {
      user: null,
      plan: null,
      subscriptionStatus: null,
      allowed: false,
      isPaidUser: false,
    };
  }

  console.log("FETCHING PROFILE...");

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  console.log("PROFILE DATA:", data);

  if (error) {
    console.error("PROFILE ERROR:", error);
  }

  if (!data) {
    return {
      user,
      plan: null,
      subscriptionStatus: null,
      allowed: false,
      isPaidUser: false,
    };
  }

  const plan = data.plan as Plan;
  const status = data.subscription_status as SubscriptionStatus;

  console.log("PLAN:", plan);
  console.log("STATUS:", status);

  return {
    user,
    plan,
    subscriptionStatus: status,
    allowed: canAccess(plan, status, "dashboard_access"),
    isPaidUser: !!plan,
  };
}