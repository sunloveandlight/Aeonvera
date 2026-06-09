"use client";

import Header from "./Header";
import Footer from "./Footer";
import { useDesignOverlay } from "@/lib/design/useDesignOverlay";
import DesignOverlayToggle from "./DesignOverlayToggle";

type AppShellProps = {
  children: React.ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  const { enabled } = useDesignOverlay();

  return (
    <main
      data-aeonvera-app
      className="relative isolate flex min-h-screen flex-col overflow-x-hidden antialiased"
    >
      {/* BACKGROUND */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-20"
      />

      <Header />

      <div className="relative flex-1 w-full">{children}</div>

      <Footer />

      {/* DESIGN SYSTEM OVERLAY INDICATOR */}
      {enabled && (
        <div className="premium-status-neutral fixed bottom-5 right-5 z-[99999] rounded-md px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]">
          DESIGN SYSTEM MODE
        </div>
      )}

      {/* TOGGLE */}
      <DesignOverlayToggle />
    </main>
  );
}
