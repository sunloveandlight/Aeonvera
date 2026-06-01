"use client";

import { supabase } from "@/lib/supabase/client";

export async function ensureProfile(userId: string) {
  if (!userId) return;

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