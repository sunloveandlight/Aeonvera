import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ✅ Always allow API routes (Stripe, webhooks, etc.)
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const res = NextResponse.next();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // ✅ Fail safely instead of crashing deployment
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Missing Supabase env vars in middleware");
    return res;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },

      setAll(
        cookies: Array<{
          name: string;
          value: string;
          options?: {
            path?: string;
            domain?: string;
            maxAge?: number;
            sameSite?: "lax" | "strict" | "none";
            secure?: boolean;
          };
        }>
      ) {
        cookies.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  // ✅ Get session safely
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isAuthPage = pathname.startsWith("/login");
  const isProtected = pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding");

  // 🔒 Protect private routes
  if (!session && isProtected) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // 🔁 Redirect logged-in users away from login
  if (session && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return res;
}

// ✅ Keep matcher tight (prevents unnecessary edge execution)
export const config = {
  matcher: ["/dashboard/:path*", "/login", "/onboarding/:path*"],
};