"use client";

import { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
};

export default function Card({
  children,
  className = "",
  hover = true,
  glow = false,
}: CardProps) {
  return (
    <div
      data-aeonvera-card
      className={`
        relative
        rounded-2xl
        border border-white/[0.06]
        bg-gradient-to-b from-white/[0.03] to-transparent
        backdrop-blur-xl

        shadow-[0_0_0_1px_rgba(255,255,255,0.03)]
        overflow-hidden

        transition-all duration-500

        ${hover ? "hover:translate-y-[-2px] hover:border-white/10 hover:shadow-[0_20px_60px_rgba(0,0,0,0.6)]" : ""}

        ${className}
      `}
    >
      {/* ================================
          LIGHT SHEEN LAYER (SURFACE REFLECTION)
      ================================= */}
      <div
        className="
          absolute inset-0
          opacity-0
          hover:opacity-100
          transition-opacity duration-700
          bg-gradient-to-br
          from-white/[0.06]
          via-transparent
          to-transparent
          pointer-events-none
        "
      />

      {/* ================================
          GOLD ENERGY LAYER (OPTIONAL)
      ================================= */}
      {glow && (
        <div
          className="
            absolute inset-0
            opacity-0
            hover:opacity-100
            transition-opacity duration-700
            bg-gradient-to-br
            from-[rgba(212,175,55,0.08)]
            via-transparent
            to-transparent
            pointer-events-none
          "
        />
      )}

      {/* ================================
          TOP EDGE LIGHT (PHYSICAL MATERIAL HINT)
      ================================= */}
      <div
        className="
          absolute top-0 left-0 right-0
          h-px
          bg-gradient-to-r
          from-transparent
          via-white/15
          to-transparent
          opacity-60
        "
      />

      {/* ================================
          DEPTH SHADOW CORE (INNER STRUCTURE)
      ================================= */}
      <div
        className="
          absolute inset-0
          shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]
          pointer-events-none
        "
      />

      {/* CONTENT */}
      <div className="relative z-10 p-6">
        {children}
      </div>
    </div>
  );
}