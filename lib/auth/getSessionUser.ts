import { supabase } from "@/lib/supabase/client";

export async function getSessionUser() {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error("getSessionUser error:", error);
      return { user: null };
    }

    if (!data.session) {
      return { user: null };
    }

    return { user: data.session.user };
  } catch (err) {
    console.error("getSessionUser exception:", err);
    return { user: null };
  }
}