import { supabase } from "@/lib/supabase/client";

export async function ensureProfile(userId: string) {
  if (!userId) return;

  const { data: existingProfile, error: fetchError } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) {
    console.error("Profile fetch error:", fetchError);
    return;
  }

  if (existingProfile) return;

  const { error: insertError } = await supabase
    .from("profiles")
    .insert([{ user_id: userId }]);

  if (insertError) {
    console.error("Profile insert error:", insertError);
  }
}