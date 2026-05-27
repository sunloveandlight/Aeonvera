import { getSupabase } from "./supabaseClient";

export type SubscriptionStatus =
  | "active"
  | "canceled"
  | "past_due"
  | "free"
  | "inactive";

export async function getUserSubscription() {
  const supabase = getSupabase();

  // 1. Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      user: null,
      subscriptionStatus: "free" as SubscriptionStatus,
      allowed: false,
      error: "No user logged in",
    };
  }

  // 2. Get profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("subscription_status")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile) {
    return {
      user,
      subscriptionStatus: "free" as SubscriptionStatus,
      allowed: false,
      error: "No profile found",
    };
  }

  const status = profile.subscription_status as SubscriptionStatus;

  // 3. Decide access
  const allowed = status === "active";

  return {
    user,
    subscriptionStatus: status,
    allowed,
    error: null,
  };
}