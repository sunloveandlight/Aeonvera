"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

export default function Header() {
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setAuthenticated(!!data.user);
      setAuthChecked(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setAuthenticated(!!session?.user);
      setAuthChecked(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-black/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">

        {/* BRAND */}
        <Link
          href="/"
          className="text-sm font-medium tracking-[0.2em] text-white/85 transition-colors duration-300 hover:text-white"
        >
          AEONVERA
        </Link>

        {/* NAV */}
        <nav className="hidden items-center gap-7 md:flex">
          <Link
            href="/pricing"
            className="text-xs font-medium text-white/50 transition-colors duration-300 hover:text-white/80"
          >
            Pricing
          </Link>
          {authenticated && (
            <>
              <Link
                href="/dashboard"
                className="text-xs font-medium text-white/50 transition-colors duration-300 hover:text-white/80"
              >
                Dashboard
              </Link>
              <Link
                href="/assessment"
                className="text-xs font-medium text-white/50 transition-colors duration-300 hover:text-white/80"
              >
                Assessment
              </Link>
              <Link
                href="/report"
                className="text-xs font-medium text-white/50 transition-colors duration-300 hover:text-white/80"
              >
                Report
              </Link>
            </>
          )}
        </nav>

        {/* AUTH */}
        <div className="flex h-9 items-center gap-3">
          <button
            onClick={() => setMobileOpen((open) => !open)}
            className="inline-flex size-10 items-center justify-center rounded-md border border-white/10 text-white/60 md:hidden"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpen}
            type="button"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          {!authChecked ? (
            <div className="hidden h-9 w-24 rounded-md border border-white/10 bg-white/[0.035] sm:block" />
          ) : authenticated ? (
            <button
              onClick={handleLogout}
              className="hidden h-9 items-center text-xs font-medium leading-none text-white/50 transition-colors duration-300 hover:text-white/80 sm:inline-flex"
            >
              Sign Out
            </button>
          ) : (
            <>
              <Link
                href="/login?mode=signin"
                className="hidden h-9 items-center text-xs font-medium leading-none text-white/50 transition-colors duration-300 hover:text-white/80 sm:inline-flex"
              >
                Sign In
              </Link>
              <Link
                href="/login?mode=signup"
                className="premium-nav-action px-4 text-xs font-medium leading-none transition"
              >
                Begin
              </Link>
            </>
          )}
        </div>

      </div>

      {mobileOpen && (
        <div className="border-t border-white/[0.08] bg-black/90 px-6 py-4 md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-2">
            <Link
              href="/pricing"
              onClick={() => setMobileOpen(false)}
              className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75"
            >
              Pricing
            </Link>
            {!authChecked ? null : authenticated ? (
              <>
                <Link
                  href="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75"
                >
                  Dashboard
                </Link>
                <Link
                  href="/assessment"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75"
                >
                  Assessment
                </Link>
                <Link
                  href="/report"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75"
                >
                  Report
                </Link>
                <button
                  onClick={handleLogout}
                  className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-sm text-white/75"
                  type="button"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                href="/login?mode=signin"
                onClick={() => setMobileOpen(false)}
                className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75"
              >
                Sign In
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
