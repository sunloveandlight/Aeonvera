import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { CookieOptions } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // 🚨 Skip API routes completely
  if (path.startsWith("/api")) {
    return NextResponse.next();
  }

  let res = NextResponse.next();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 🛑 Prevent runtime crash if env vars are missing
  if (!supabaseUrl || !supabaseAnon) {
    console.error("Missing Supabase env vars in middleware");
    return res;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnon,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },

        setAll(
          cookies: {
            name: string;
            value: string;
            options?: CookieOptions;
          }[]
        ) {
          cookies.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // 👤 Get user (safe for middleware)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtectedRoute =
    path.startsWith("/dashboard") || path.startsWith("/onboarding");

  // 🔒 Block unauthenticated users
  if (!user && isProtectedRoute) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // 🔁 Redirect logged-in users away from login
  if (user && path.startsWith("/login")) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/((?!api).*)"],
};