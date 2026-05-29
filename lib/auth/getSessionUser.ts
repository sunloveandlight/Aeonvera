import { supabase } from "@/lib/supabase/client";

export async function getSessionUser() {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session) {
    return { user: null };
  }

  return { user: data.session.user };
}