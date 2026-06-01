import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log("🔍 SUPABASE ADMIN CHECK:");
  console.log("URL:", url ? "EXISTS" : "MISSING");
  console.log("KEY:", key ? "EXISTS" : "MISSING");

  if (!url || !key) {
    throw new Error(
      `Missing env vars: url=${!!url}, key=${!!key}`
    );
  }

  return createClient(url, key);
}