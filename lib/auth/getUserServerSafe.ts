import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function getUserServerSafe() {
  const cookieStore = await cookies(); // ✅ FIX: must await in your Next.js version

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Server-side read only (no writes needed here)
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("getUserServerSafe error:", error);
    return null;
  }

  return user;
}