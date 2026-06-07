"use client";

import { ReactNode } from "react";

type PageProps = {
  children: ReactNode;
  className?: string;
  density?: "compact" | "normal" | "spacious";
};

export default function Page({
  children,
  className = "",
  density = "normal",
}: PageProps) {
  const spacing = {
    compact: "space-y-16",
    normal: "space-y-28",
    spacious: "space-y-40",
  };

  return (
    <div
      data-aeonvera-page
      className={`
        relative w-full
        flex flex-col
        ${spacing[density]}
        pb-40
        ${className}
      `}
    >
      {/* ================================
          PAGE LIGHT FALLBACK (TOP-TO-BOTTOM GRADIENT FLOW)
      ================================= */}
      <div
        aria-hidden
        className="
          pointer-events-none
          absolute inset-0
          bg-gradient-to-b
          from-white/[0.02]
          via-transparent
          to-black/20
          opacity-60
        "
      />

      {/* ================================
          CONTENT LAYER
      ================================= */}
      <div className="relative z-10 flex flex-col w-full">
        {children}
      </div>
    </div>
  );
}