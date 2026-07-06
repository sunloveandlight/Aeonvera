"use client";

import Header from "./Header";
import Footer from "./Footer";
import { useDesignAudit } from "@/lib/audit/useDesignAudit";
import { useDesignOverlay } from "@/lib/design/useDesignOverlay";
import { usePathname } from "next/navigation";
import DesignOverlayToggle from "./DesignOverlayToggle";
import AeonCommandOrb from "./AeonCommandOrb";
import ClientRuntimeGuards from "./ClientRuntimeGuards";

type AppShellProps = {
  children: React.ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const { enabled, toggle } = useDesignOverlay();
  const designToolsEnabled =
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_SHOW_DESIGN_TOOLS === "true";
  useDesignAudit(designToolsEnabled && enabled);
  const isWaitlistPage = pathname === "/waitlist";
  const isProfessionalPage = pathname?.startsWith("/professional");
  const hideSiteChrome = isWaitlistPage || isProfessionalPage;

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

      {!hideSiteChrome && <Header />}

      <div className={`relative flex-1 w-full ${hideSiteChrome ? "" : "pt-11"}`}>
        {children}
      </div>

      {!hideSiteChrome && <Footer />}

      {!hideSiteChrome && <AeonCommandOrb />}
      <ClientRuntimeGuards />

      {/* DESIGN SYSTEM OVERLAY INDICATOR */}
      {designToolsEnabled && enabled && (
        <div className="av-eyebrow premium-status-neutral fixed bottom-5 right-5 z-[99999] rounded-md px-4 py-2 font-semibold">
          DESIGN SYSTEM MODE
        </div>
      )}

      {/* TOGGLE */}
      {designToolsEnabled && enabled ? (
        <DesignOverlayToggle enabled={enabled} onToggle={toggle} />
      ) : null}
    </main>
  );
}
