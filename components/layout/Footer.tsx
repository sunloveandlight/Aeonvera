"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-[rgba(36,50,74,0.12)] bg-[rgba(251,250,247,0.72)]">
      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8">

        {/* TOP ROW */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">

          {/* BRAND */}
          <div className="text-sm font-semibold tracking-normal text-[var(--ink)]">
            AEONVERA
          </div>

          {/* NAV LINKS */}
          <div className="flex flex-wrap gap-5 text-sm text-[rgba(38,51,73,0.58)]">
            <Link href="/pricing" className="transition hover:text-[var(--ink)]">
              Pricing
            </Link>
            <Link href="/dashboard" className="transition hover:text-[var(--ink)]">
              Dashboard
            </Link>
            <Link href="/assessment" className="transition hover:text-[var(--ink)]">
              Assessment
            </Link>
            <Link href="/report" className="transition hover:text-[var(--ink)]">
              Report
            </Link>
          </div>

        </div>

        {/* BOTTOM ROW */}
        <div className="mt-8 flex flex-col gap-4 border-t border-[rgba(36,50,74,0.1)] pt-6 md:flex-row md:items-center md:justify-between">

          <p className="text-xs text-[rgba(38,51,73,0.48)]">
            © {new Date().getFullYear()} AEONVERA. All rights reserved.
          </p>

          <p className="text-xs text-[rgba(38,51,73,0.48)]">
            Private longevity intelligence
          </p>

        </div>

      </div>
    </footer>
  );
}
