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
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 backdrop-blur-xl bg-black/70">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">

        <Link
          href="/"
          className="text-lg font-semibold tracking-[0.25em]"
        >
          AEONVERA
        </Link>

        <nav className="hidden md:flex items-center gap-10">

          <Link
            href="/pricing"
            className="text-sm text-white/60 hover:text-white transition"
          >
            Pricing
          </Link>

          {authenticated && (
            <>
              <Link
                href="/dashboard"
                className="text-sm text-white/60 hover:text-white transition"
              >
                Dashboard
              </Link>

              <Link
                href="/assessment"
                className="text-sm text-white/60 hover:text-white transition"
              >
                Assessment
              </Link>

              <Link
                href="/report"
                className="text-sm text-white/60 hover:text-white transition"
              >
                Report
              </Link>
            </>
          )}

        </nav>

        <div className="flex items-center gap-4">

          {authenticated ? (
            <button
              onClick={handleLogout}
              className="
                h-11
                px-5
                rounded-xl
                border
                border-white/10
                bg-white/5
                text-white
                text-sm
                font-medium
                hover:bg-white/10
                transition
              "
            >
              Logout
            </button>
          ) : (
            <>
              <Link
                href="/login?mode=signin"
                className="text-sm text-white/60 hover:text-white"
              >
                Sign In
              </Link>

              <Link
                href="/login?mode=signup"
                className="
                  h-11
                  px-5
                  rounded-xl
                  bg-white
                  text-black
                  text-sm
                  font-medium
                  flex
                  items-center
                "
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