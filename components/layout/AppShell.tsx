"use client";

import Header from "./Header";
import Footer from "./Footer";
import { useOverlayMode } from "@/lib/audit/useOverlayMode";

type AppShellProps = {
  children: React.ReactNode;
};

export default function AppShell({
  children,
}: AppShellProps) {
  const overlayEnabled = useOverlayMode();

  return (
    <main
      data-aeonvera-app
      className="
        relative
        isolate
        flex
        min-h-screen
        flex-col
        overflow-x-hidden
        antialiased
      "
    >
      {/* Background Glow */}

      <div
        aria-hidden
        className="
          pointer-events-none
          fixed
          inset-0
          -z-20

          bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_38%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.07),transparent_34%),radial-gradient(circle_at_bottom,rgba(255,255,255,0.025),transparent_55%)]
        "
      />

      {/* Noise Layer */}

      <div
        aria-hidden
        className="
          pointer-events-none
          fixed
          inset-0
          -z-10
          opacity-[0.018]
          mix-blend-soft-light
          bg-[url('/noise.png')]
        "
      />

      {/* Header */}

      <Header />

      {/* Main */}

      <div
        className="
          relative
          flex-1
          w-full
        "
      >
        {children}
      </div>

      {/* Footer */}

      <Footer />

      {/* Dev Overlay */}

      {overlayEnabled && (
        <div
          className="
            fixed
            bottom-5
            right-5
            z-[99999]

            rounded-full
            border
            border-white/15
            bg-white/90

            px-4
            py-2

            backdrop-blur-xl

            text-[10px]
            font-semibold
            uppercase
            tracking-[0.28em]
            text-black

            shadow-xl
          "
        >
          AEONVERA OVERLAY
        </div>
      )}
    </main>
  );
}