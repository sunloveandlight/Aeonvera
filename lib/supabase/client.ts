import { createBrowserClient } from "@supabase/ssr";

let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (typeof window === "undefined") {
    throw new Error("Supabase browser client used on server");
  }

  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error("Missing Supabase browser env vars");
    }

    supabaseInstance = createBrowserClient(url, key);
  }

  return supabaseInstance;
}

// keep compatibility with existing code
export const supabase = {
  auth: {
    getSession: async () => getSupabaseBrowserClient().auth.getSession(),
    signInWithPassword: async (args: any) =>
      getSupabaseBrowserClient().auth.signInWithPassword(args),
    signOut: async () => getSupabaseBrowserClient().auth.signOut(),
  },
  from: (...args: any[]) => getSupabaseBrowserClient().from(args[0]),
};