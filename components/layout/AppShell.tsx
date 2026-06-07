"use client";

import Header from "./Header";
import Footer from "./Footer";
import { useOverlayMode } from "@/lib/audit/useOverlayMode";

type AppShellProps = {
  children: React.ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  const overlayEnabled = useOverlayMode();

  return (
    <main
      data-aeonvera-app
      className="relative isolate flex min-h-screen flex-col overflow-x-hidden antialiased"
    >
      {/* Background Glow — gold & platinum */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-20"
        style={{
          background: `
            radial-gradient(900px circle at 15% 10%, rgba(212,175,55,0.07), transparent 60%),
            radial-gradient(700px circle at 85% 20%, rgba(229,228,226,0.04), transparent 55%),
            radial-gradient(800px circle at 50% 100%, rgba(180,140,60,0.05), transparent 60%)
          `,
        }}
      />

      {/* Header */}
      <Header />

      {/* Main */}
      <div className="relative flex-1 w-full">
        {children}
      </div>

      {/* Footer */}
      <Footer />

      {/* Dev Overlay */}
      {overlayEnabled && (
        <div className="fixed bottom-5 right-5 z-[99999] rounded-full border border-white/15 bg-white/90 px-4 py-2 backdrop-blur-xl text-[10px] font-semibold uppercase tracking-[0.28em] text-black shadow-xl">
          AEONVERA OVERLAY
        </div>
      )}
    </main>
  );
}