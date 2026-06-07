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
    <header className="sticky top-0 z-50 border-b border-white/[0.05] backdrop-blur-xl bg-[#08070a]/85">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">

        {/* BRAND */}
        <Link
          href="/"
          className="text-sm font-light tracking-[0.5em] text-white/70 hover:text-white transition-colors duration-500"
        >
          AEONVERA
        </Link>

        {/* NAV */}
        <nav className="hidden md:flex items-center gap-10">
          <Link
            href="/pricing"
            className="text-[10px] uppercase tracking-[0.35em] text-white/30 hover:text-white/60 transition-colors duration-300"
          >
            Pricing
          </Link>
          {authenticated && (
            <>
              <Link
                href="/dashboard"
                className="text-[10px] uppercase tracking-[0.35em] text-white/30 hover:text-white/60 transition-colors duration-300"
              >
                Dashboard
              </Link>
              <Link
                href="/assessment"
                className="text-[10px] uppercase tracking-[0.35em] text-white/30 hover:text-white/60 transition-colors duration-300"
              >
                Assessment
              </Link>
              <Link
                href="/report"
                className="text-[10px] uppercase tracking-[0.35em] text-white/30 hover:text-white/60 transition-colors duration-300"
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
              className="text-[10px] uppercase tracking-[0.35em] text-white/30 hover:text-white/60 transition-colors duration-300"
            >
              Sign Out
            </button>
          ) : (
            <>
              <Link
                href="/login?mode=signin"
                className="text-[10px] uppercase tracking-[0.35em] text-white/30 hover:text-white/60 transition-colors duration-300"
              >
                Sign In
              </Link>
              <Link
                href="/login?mode=signup"
                className="h-10 px-6 rounded-full border border-[rgba(212,175,55,0.25)] text-[10px] uppercase tracking-[0.35em] text-[rgba(212,175,55,0.7)] hover:border-[rgba(212,175,55,0.5)] hover:text-[rgba(212,175,55,1)] flex items-center transition-all duration-300"
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