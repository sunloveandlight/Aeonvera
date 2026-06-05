import { createClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client (frontend only)
 *
 * RULES:
 * - DO NOT put auth rules here
 * - DO NOT check subscriptions here
 * - DO NOT gate features here
 *
 * This file is ONLY for:
 * - login / logout
 * - session retrieval
 * - UI state
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Prevent crashes if env is missing (better DX)
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
}

// Singleton pattern (prevents multiple clients in dev/hot reload)
let supabaseInstance: ReturnType<typeof createClient> | null = null;

export const supabase = (() => {
  if (supabaseInstance) return supabaseInstance;

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return supabaseInstance;
})();