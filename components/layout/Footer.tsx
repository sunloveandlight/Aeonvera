"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-white/[0.07] bg-black/35">
      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8">

        {/* TOP ROW */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">

          {/* BRAND */}
          <div className="text-sm font-medium tracking-[0.2em] text-white/85">
            AEONVERA
          </div>

          {/* NAV LINKS */}
          <div className="flex flex-wrap gap-5 text-sm text-white/45">
            <Link href="/pricing" className="transition hover:text-white">
              Pricing
            </Link>
            <Link href="/dashboard" className="transition hover:text-white">
              Dashboard
            </Link>
            <Link href="/assessment" className="transition hover:text-white">
              Assessment
            </Link>
            <Link href="/report" className="transition hover:text-white">
              Report
            </Link>
          </div>

        </div>

        {/* BOTTOM ROW */}
        <div className="mt-8 flex flex-col gap-4 border-t border-white/[0.07] pt-6 md:flex-row md:items-center md:justify-between">

          <p className="text-xs text-white/35">
            © {new Date().getFullYear()} AEONVERA. All rights reserved.
          </p>

          <p className="text-xs text-white/35">
            Private longevity intelligence
          </p>

        </div>

      </div>
    </footer>
  );
}
