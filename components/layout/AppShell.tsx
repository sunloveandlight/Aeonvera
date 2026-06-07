"use client";

import Header from "./Header";
import Footer from "./Footer";
import { useOverlayMode } from "@/lib/audit/useOverlayMode";
import { useEffect } from "react";

type AppShellProps = {
  children: React.ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  const overlayEnabled = useOverlayMode();

  // Adds global “light system class” for physics layering
  useEffect(() => {
    document.body.classList.add("aeonvera-light-system");

    return () => {
      document.body.classList.remove("aeonvera-light-system");
    };
  }, []);

  return (
    <main
      data-aeonvera-app
      className="
        relative isolate
        flex min-h-screen flex-col
        overflow-x-hidden
        antialiased
        text-white
        bg-[#07070a]
      "
    >
      {/* ================================
          LAYER 0 — DEEP SPACE BACKGROUND
      ================================= */}
      <div
        aria-hidden
        className="fixed inset-0 -z-30"
        style={{
          background: `
            radial-gradient(1200px circle at 20% 10%, rgba(212,175,55,0.10), transparent 60%),
            radial-gradient(900px circle at 80% 20%, rgba(229,228,226,0.05), transparent 55%),
            radial-gradient(1100px circle at 50% 110%, rgba(180,140,60,0.06), transparent 60%),
            radial-gradient(800px circle at 10% 80%, rgba(255,255,255,0.03), transparent 60%)
          `,
        }}
      />

      {/* ================================
          LAYER 1 — LIGHT FIELD (ANIMATED GLOW BASE)
      ================================= */}
      <div
        aria-hidden
        className="
          fixed inset-0 -z-20
          opacity-80
          animate-pulse
        "
        style={{
          background: `
            radial-gradient(900px circle at 50% 0%, rgba(212,175,55,0.06), transparent 55%),
            radial-gradient(800px circle at 80% 30%, rgba(255,255,255,0.03), transparent 60%)
          `,
          filter: "blur(0px)",
        }}
      />

      {/* ================================
          LAYER 2 — STRUCTURAL GRID (VERY SUBTLE)
      ================================= */}
      <div
        aria-hidden
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage: `
            linear-gradient(rgba(212,175,55,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(212,175,55,0.04) 1px, transparent 1px)
          `,
          backgroundSize: "120px 120px",
          maskImage:
            "radial-gradient(circle at center, black 30%, transparent 75%)",
          opacity: 0.25,
        }}
      />

      {/* ================================
          HEADER (FLOATING LAYER)
      ================================= */}
      <div className="relative z-50">
        <Header />
      </div>

      {/* ================================
          MAIN CONTENT LAYER (FOCAL REALITY PLANE)
      ================================= */}
      <div
        className="
          relative z-10
          flex-1 w-full
        "
      >
        {/* soft top vignette for depth */}
        <div className="pointer-events-none fixed top-0 left-0 right-0 h-40 bg-gradient-to-b from-black/40 to-transparent z-20" />

        {children}
      </div>

      {/* ================================
          FOOTER LAYER (GROUND PLANE)
      ================================= */}
      <div className="relative z-10">
        <Footer />
      </div>

      {/* ================================
          DEPTH VIGNETTE (GLOBAL CINEMATIC EDGE)
      ================================= */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background: `
            radial-gradient(circle at center, transparent 40%, rgba(0,0,0,0.55) 100%)
          `,
        }}
      />

      {/* ================================
          DEV OVERLAY
      ================================= */}
      {overlayEnabled && (
        <div className="fixed bottom-5 right-5 z-[99999] rounded-full border border-white/15 bg-white/90 px-4 py-2 backdrop-blur-xl text-[10px] font-semibold uppercase tracking-[0.28em] text-black shadow-xl">
          AEONVERA LIGHT SYSTEM
        </div>
      )}
    </main>
  );
}