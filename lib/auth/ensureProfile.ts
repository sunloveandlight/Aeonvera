import { createClient } from "@supabase/supabase-js";

function getBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase browser env vars");
  }

  return createClient(url, key);
}

export async function ensureProfile(userId: string) {
  if (!userId) return;

  const supabase = getBrowserSupabase();

  const { data } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (data) return;

  const { error } = await supabase.from("profiles").insert({
    user_id: userId,
    plan: "free",
    subscription_status: "inactive",
    entity_state: "dormant",
    onboarding_completed: false,
    life_stage: "initializing",
  });

  if (error) {
    console.error("ensureProfile INSERT ERROR:", error);
  }
}