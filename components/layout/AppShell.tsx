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
      className="
        min-h-screen
        flex flex-col
        antialiased
        relative
      "
      data-aeonvera-app
    >
      {/* HEADER */}
      <Header />

      {/* SYSTEM INDICATOR (DEV ONLY) */}
      {overlayEnabled && (
        <div className="fixed bottom-4 right-4 z-[9999] px-3 py-1 rounded-full bg-white text-black text-xs">
          AEONVERA OVERLAY
        </div>
      )}

      {/* PAGE CONTENT */}
      <div className="flex-1">
        {children}
      </div>

      {/* FOOTER */}
      <Footer />
    </main>
  );
}