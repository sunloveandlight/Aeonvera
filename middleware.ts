import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  // Create Supabase client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          } catch {
            // Ignore if response already sent
          }
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  const isDashboard = req.nextUrl.pathname.startsWith('/dashboard');
  const isLogin = req.nextUrl.pathname === '/login';

  // Redirect to login if trying to access dashboard without session
  if (isDashboard && !session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Redirect to dashboard if already logged in and trying to access login
  const mode = req.nextUrl.searchParams.get("mode");

const isSignup =
  req.nextUrl.pathname === "/login" &&
  mode === "signup";

if (isLogin && session && !isSignup) {
  return NextResponse.redirect(
    new URL('/dashboard', req.url)
  );
}

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
};