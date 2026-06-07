"use client";

import { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;

  // compatibility layer (IMPORTANT)
  label?: string;
  title?: string;
};

export default function Card({
  children,
  className = "",
  hover = true,
  glow = false,
  label,
  title,
}: CardProps) {
  const header = label || title;

  return (
    <div
      data-aeonvera-card
      className={`
        relative rounded-2xl
        border border-white/[0.06]
        bg-gradient-to-b from-white/[0.03] to-transparent
        backdrop-blur-xl
        overflow-hidden
        transition-all duration-500
        shadow-[0_0_0_1px_rgba(255,255,255,0.03)]

        ${hover ? "hover:translate-y-[-2px] hover:border-white/10 hover:shadow-[0_20px_60px_rgba(0,0,0,0.6)]" : ""}
        ${className}
      `}
    >
      {/* subtle glow layer */}
      {glow && (
        <div className="absolute inset-0 bg-gradient-to-br from-[rgba(212,175,55,0.08)] to-transparent opacity-0 hover:opacity-100 transition-opacity duration-700" />
      )}

      {/* top edge light */}
      <div className="absolute top-0 left-0 right-0 h-px bg-white/10" />

      <div className="relative z-10 p-6">
        {header && (
          <p className="text-[10px] tracking-[0.4em] uppercase text-white/40 mb-4">
            {header}
          </p>
        )}

        {children}
      </div>
    </div>
  );
}