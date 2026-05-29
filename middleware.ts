import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { CookieOptions } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  let res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
          cookies.forEach(
            (cookie: {
              name: string;
              value: string;
              options?: CookieOptions;
            }) => {
              res.cookies.set(cookie.name, cookie.value, cookie.options);
            }
          );
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const path = req.nextUrl.pathname;

  const isDashboard = path.startsWith("/dashboard");
  const isLogin = path.startsWith("/login");
  const isOnboarding = path.startsWith("/onboarding");

  if (!session) {
    if (isDashboard || isOnboarding) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  if (session && isLogin) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/onboarding"],
};