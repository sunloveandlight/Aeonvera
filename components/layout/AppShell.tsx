"use client";

import React from "react";
import Header from "./Header";
import Link from "next/link";
import { usePathname } from "next/navigation";

type AppShellProps = {
  children: React.ReactNode;
};

/**
 * Pages that SHOULD show footer (marketing layer only)
 */
const FOOTER_ALLOWED_ROUTES = ["/", "/pricing"];

function Footer() {
  return (
    <footer className="border-t border-white/10 mt-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row justify-between gap-10">

          {/* Brand */}
          <div>
            <p className="text-sm tracking-[0.35em] font-medium">
              AEONVERA
            </p>
            <p className="text-white/40 text-sm mt-4 max-w-sm">
              A biological intelligence system for long-term human optimization.
            </p>
          </div>

          {/* Links */}
          <div className="grid grid-cols-2 gap-10 text-sm text-white/60">
            <div className="space-y-3">
              <p className="text-white/40 text-xs uppercase tracking-[0.3em]">
                Product
              </p>
              <Link href="/pricing" className="hover:text-white transition">
                Pricing
              </Link>
              <Link href="/login" className="hover:text-white transition">
                Login
              </Link>
            </div>

            <div className="space-y-3">
              <p className="text-white/40 text-xs uppercase tracking-[0.3em]">
                System
              </p>
              <Link href="/dashboard" className="hover:text-white transition">
                Dashboard
              </Link>
              <Link href="/report" className="hover:text-white transition">
                Report
              </Link>
            </div>
          </div>

          {/* Legal */}
          <div className="text-white/30 text-xs leading-relaxed max-w-xs">
            <p>
              This platform does not provide medical advice, diagnosis, or treatment.
            </p>
            <p className="mt-4">
              © {new Date().getFullYear()} Aeonvera. All rights reserved.
            </p>
          </div>

        </div>
      </div>
    </footer>
  );
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  const showFooter = FOOTER_ALLOWED_ROUTES.includes(pathname);

  return (
    <main className="min-h-screen bg-black text-white relative">

      {/* GLOBAL BACKGROUND SYSTEM (single source of truth) */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-black" />

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_40%)]" />

        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(255,255,255,0.02))]" />
      </div>

      {/* HEADER (single authority) */}
      <Header />

      {/* PAGE CONTENT */}
      <div className="relative z-10">
        {children}
      </div>

      {/* FOOTER (only marketing pages) */}
      {showFooter && <Footer />}

    </main>
  );
}