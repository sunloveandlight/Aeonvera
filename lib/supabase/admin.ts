import { createClient } from "@supabase/supabase-js";

/**
 * Aeonvera — Supabase Admin Client Factory
 * -----------------------------------------
 * EXPLICIT FACTORY PATTERN (no singleton).
 *
 * Always call getSupabaseAdmin() directly.
 * Never import a pre-built instance.
 *
 * This ensures:
 * - fresh client per call
 * - clear error messages if env vars are missing
 * - no module-load-time side effects
 * - safe for serverless / edge environments
 */
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      "[Aeonvera] Missing NEXT_PUBLIC_SUPABASE_URL — check your environment variables."
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "[Aeonvera] Missing SUPABASE_SERVICE_ROLE_KEY — check your environment variables."
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}