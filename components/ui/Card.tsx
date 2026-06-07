"use client";

import { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;

  // system controls (NEW)
  title?: string;
  glow?: boolean;
  hover?: boolean;
};

export default function Card({
  children,
  className = "",
  title,
  glow = false,
  hover = true,
}: CardProps) {
  return (
    <div
      data-aeonvera-card
      className={`
        relative overflow-hidden
        rounded-2xl
        border border-white/[0.06]
        bg-gradient-to-b from-white/[0.03] to-transparent
        backdrop-blur-xl

        shadow-[0_0_0_1px_rgba(255,255,255,0.03)]
        transition-all duration-500

        ${hover ? "hover:translate-y-[-2px] hover:border-white/10 hover:shadow-[0_20px_60px_rgba(0,0,0,0.6)]" : ""}

        ${className}
      `}
    >
      {/* TOP EDGE LIGHT */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent opacity-60" />

      {/* LIGHT SHEEN */}
      <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-700 bg-gradient-to-br from-white/[0.06] via-transparent to-transparent pointer-events-none" />

      {/* GOLD GLOW (optional system state) */}
      {glow && (
        <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-700 bg-gradient-to-br from-[rgba(212,175,55,0.08)] via-transparent to-transparent pointer-events-none" />
      )}

      {/* INNER SHADOW DEPTH */}
      <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] pointer-events-none" />

      {/* CONTENT */}
      <div className="relative z-10 p-6">

        {/* TITLE (NEW SYSTEM HEADER) */}
        {title && (
          <div className="mb-4 pb-3 border-b border-white/5">
            <p className="text-[10px] uppercase tracking-[0.4em] text-white/30">
              {title}
            </p>
          </div>
        )}

        {children}
      </div>
    </div>
  );
}