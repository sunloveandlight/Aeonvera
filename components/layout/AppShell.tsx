"use client";

import Header from "./Header";
import Footer from "./Footer";

type AppShellProps = {
  children: React.ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col antialiased">

      {/* GLOBAL BACKGROUND */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-black" />

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_45%)]" />

        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(255,255,255,0.02))]" />
      </div>

      {/* HEADER (SINGLE SOURCE OF TRUTH) */}
      <Header />

      {/* PAGE CONTENT */}
      <div className="flex-1">
        {children}
      </div>

      {/* FOOTER */}
      <Footer />

    </main>
  );
}