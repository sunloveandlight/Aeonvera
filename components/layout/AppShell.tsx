"use client";

import Header from "./Header";
import Footer from "./Footer";
import { useDesignAudit } from "@/lib/audit/useDesignAudit";
import { useDesignOverlay } from "@/lib/design/useDesignOverlay";
import DesignOverlayToggle from "./DesignOverlayToggle";
import AeonCommandOrb from "./AeonCommandOrb";

type AppShellProps = {
  children: React.ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  const { enabled, toggle } = useDesignOverlay();
  const designToolsEnabled = process.env.NODE_ENV !== "production";
  useDesignAudit(designToolsEnabled && enabled);

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

      <AeonCommandOrb />

      {/* DESIGN SYSTEM OVERLAY INDICATOR */}
      {designToolsEnabled && enabled && (
        <div className="premium-status-neutral fixed bottom-5 right-5 z-[99999] rounded-md px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]">
          DESIGN SYSTEM MODE
        </div>
      )}

      {/* TOGGLE */}
      {designToolsEnabled ? (
        <DesignOverlayToggle enabled={enabled} onToggle={toggle} />
      ) : null}
    </main>
  );
}
