"use client";

import Link from "next/link";

export default function Header() {
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

          <Link
            href="/dashboard"
            className="text-sm text-white/60 hover:text-white transition"
          >
            Dashboard
          </Link>
        </nav>

        <div className="flex items-center gap-4">
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
        </div>

      </div>
    </header>
  );
}