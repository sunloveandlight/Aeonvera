import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { CookieOptions } from "@supabase/ssr";

type Cookie = {
  name: string;
  value: string;
  options?: CookieOptions;
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow API routes
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const res = NextResponse.next();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Missing Supabase env vars in middleware");
    return res;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },

      setAll(cookies: Cookie[]) {
        cookies.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  /**
   * FIXED AUTH STRATEGY:
   * getUser() is more stable in middleware than getSession()
   */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPage = pathname.startsWith("/login");
  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/onboarding");

  // 🔒 Protect private routes
  if (!user && isProtected) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // 🔁 Redirect logged-in users away from login
  if (user && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/onboarding/:path*"],
};