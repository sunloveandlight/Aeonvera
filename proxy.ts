import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { CookieOptions } from "@supabase/ssr";

type Cookie = {
  name: string;
  value: string;
  options?: CookieOptions;
};

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const res = NextResponse.next();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Missing Supabase env vars in proxy");
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPage = pathname.startsWith("/login");
  const isProtected =
    pathname.startsWith("/companion") ||
    pathname.startsWith("/data-sources") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/digital-twin") ||
    pathname.startsWith("/life-autopilot") ||
    pathname.startsWith("/life-os") ||
    pathname.startsWith("/memory") ||
    pathname.startsWith("/network") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/physician-export") ||
    pathname.startsWith("/plan") ||
    pathname.startsWith("/assessment") ||
    pathname.startsWith("/report") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/success");

  if (!user && isProtected) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return res;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/companion/:path*",
    "/data-sources/:path*",
    "/digital-twin/:path*",
    "/life-autopilot/:path*",
    "/life-os/:path*",
    "/login",
    "/memory/:path*",
    "/network/:path*",
    "/onboarding/:path*",
    "/physician-export/:path*",
    "/plan/:path*",
    "/assessment/:path*",
    "/report/:path*",
    "/settings/:path*",
    "/success",
  ],
};
