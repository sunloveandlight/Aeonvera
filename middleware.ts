import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { CookieOptions } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Skip API routes entirely
  if (path.startsWith("/api")) {
    return NextResponse.next();
  }

  const res = NextResponse.next();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // HARD SAFETY CHECK (prevents Vercel crash)
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

  // SAFE AUTH CHECK
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isProtected =
    path.startsWith("/dashboard") || path.startsWith("/onboarding");

  // redirect unauthenticated users
  if (!session && isProtected) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // redirect logged-in users away from login
  if (session && path.startsWith("/login")) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/((?!api).*)"],
};