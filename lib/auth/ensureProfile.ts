import { supabase } from "@/lib/supabase/client";

export async function ensureProfile(userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (profile) return;

  await supabase.from("profiles").insert({
    user_id: userId,
    plan: null,
    billing_type: null,
    subscription_status: "inactive",
    entity_state: "dormant",
    onboarding_completed: false,
    life_stage: "initializing",
  });
}