"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function Header() {
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setAuthenticated(!!data.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setAuthenticated(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] backdrop-blur-xl bg-[#05060a]/80">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">

        {/* BRAND */}
        <Link
          href="/"
          className="text-sm font-light tracking-[0.4em] text-white/80 hover:text-white transition-colors duration-300"
        >
          AEONVERA
        </Link>

        {/* NAV */}
        <nav className="hidden md:flex items-center gap-10">
          <Link
            href="/pricing"
            className="text-[11px] uppercase tracking-[0.3em] text-white/35 hover:text-white/70 transition-colors duration-300"
          >
            Pricing
          </Link>
          {authenticated && (
            <>
              <Link
                href="/dashboard"
                className="text-[11px] uppercase tracking-[0.3em] text-white/35 hover:text-white/70 transition-colors duration-300"
              >
                Dashboard
              </Link>
              <Link
                href="/assessment"
                className="text-[11px] uppercase tracking-[0.3em] text-white/35 hover:text-white/70 transition-colors duration-300"
              >
                Assessment
              </Link>
              <Link
                href="/report"
                className="text-[11px] uppercase tracking-[0.3em] text-white/35 hover:text-white/70 transition-colors duration-300"
              >
                Report
              </Link>
            </>
          )}
        </nav>

        {/* AUTH */}
        <div className="flex items-center gap-6">
          {authenticated ? (
            <button
              onClick={handleLogout}
              className="text-[11px] uppercase tracking-[0.3em] text-white/35 hover:text-white/70 transition-colors duration-300"
            >
              Sign Out
            </button>
          ) : (
            <>
              <Link
                href="/login?mode=signin"
                className="text-[11px] uppercase tracking-[0.3em] text-white/35 hover:text-white/70 transition-colors duration-300"
              >
                Sign In
              </Link>
              <Link
                href="/login?mode=signup"
                className="h-10 px-6 rounded-full border border-white/15 text-[11px] uppercase tracking-[0.3em] text-white/70 hover:border-white/30 hover:text-white flex items-center transition-all duration-300"
              >
                Begin
              </Link>
            </>
          )}
        </div>

      </div>
    </header>
  );
}