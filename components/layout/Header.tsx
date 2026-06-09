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
    <header className="sticky top-0 z-50 border-b border-[rgba(36,50,74,0.12)] bg-[rgba(251,250,247,0.82)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">

        {/* BRAND */}
        <Link
          href="/"
          className="text-sm font-semibold tracking-normal text-[var(--ink)] transition-colors duration-300 hover:text-[rgb(var(--royal))]"
        >
          AEONVERA
        </Link>

        {/* NAV */}
        <nav className="hidden items-center gap-7 md:flex">
          <Link
            href="/pricing"
            className="text-xs font-medium text-[rgba(38,51,73,0.62)] transition-colors duration-300 hover:text-[var(--ink)]"
          >
            Pricing
          </Link>
          {authenticated && (
            <>
              <Link
                href="/dashboard"
                className="text-xs font-medium text-[rgba(38,51,73,0.62)] transition-colors duration-300 hover:text-[var(--ink)]"
              >
                Dashboard
              </Link>
              <Link
                href="/assessment"
                className="text-xs font-medium text-[rgba(38,51,73,0.62)] transition-colors duration-300 hover:text-[var(--ink)]"
              >
                Assessment
              </Link>
              <Link
                href="/report"
                className="text-xs font-medium text-[rgba(38,51,73,0.62)] transition-colors duration-300 hover:text-[var(--ink)]"
              >
                Report
              </Link>
            </>
          )}
        </nav>

        {/* AUTH */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen((open) => !open)}
            className="inline-flex size-10 items-center justify-center rounded-md border border-[rgba(36,50,74,0.14)] text-[rgba(38,51,73,0.7)] md:hidden"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpen}
            type="button"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          {!authChecked ? (
            <div className="hidden h-10 w-24 rounded-md border border-[rgba(36,50,74,0.12)] bg-white/70 sm:block" />
          ) : authenticated ? (
            <button
              onClick={handleLogout}
              className="hidden text-xs font-medium text-[rgba(38,51,73,0.62)] transition-colors duration-300 hover:text-[var(--ink)] sm:inline-flex"
            >
              Sign Out
            </button>
          ) : (
            <>
              <Link
                href="/login?mode=signin"
                className="hidden text-xs font-medium text-[rgba(38,51,73,0.62)] transition-colors duration-300 hover:text-[var(--ink)] sm:inline-flex"
              >
                Sign In
              </Link>
              <Link
                href="/login?mode=signup"
                className="premium-button-primary flex h-10 items-center rounded-md px-4 text-xs font-medium transition hover:opacity-95"
              >
                Begin
              </Link>
            </>
          )}
        </div>

      </div>

      {mobileOpen && (
        <div className="border-t border-[rgba(36,50,74,0.12)] bg-[rgba(251,250,247,0.94)] px-6 py-4 md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-2">
            <Link
              href="/pricing"
              onClick={() => setMobileOpen(false)}
              className="rounded-md border border-[rgba(36,50,74,0.12)] bg-white/70 px-3 py-2 text-sm text-[rgba(16,24,39,0.78)]"
            >
              Pricing
            </Link>
            {!authChecked ? null : authenticated ? (
              <>
                <Link
                  href="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md border border-[rgba(36,50,74,0.12)] bg-white/70 px-3 py-2 text-sm text-[rgba(16,24,39,0.78)]"
                >
                  Dashboard
                </Link>
                <Link
                  href="/assessment"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md border border-[rgba(36,50,74,0.12)] bg-white/70 px-3 py-2 text-sm text-[rgba(16,24,39,0.78)]"
                >
                  Assessment
                </Link>
                <Link
                  href="/report"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md border border-[rgba(36,50,74,0.12)] bg-white/70 px-3 py-2 text-sm text-[rgba(16,24,39,0.78)]"
                >
                  Report
                </Link>
                <button
                  onClick={handleLogout}
                  className="rounded-md border border-[rgba(36,50,74,0.12)] bg-white/70 px-3 py-2 text-left text-sm text-[rgba(16,24,39,0.78)]"
                  type="button"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                href="/login?mode=signin"
                onClick={() => setMobileOpen(false)}
                className="rounded-md border border-[rgba(36,50,74,0.12)] bg-white/70 px-3 py-2 text-sm text-[rgba(16,24,39,0.78)]"
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
