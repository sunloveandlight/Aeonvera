"use client";

import { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
  title?: string;
};

export default function Card({
  children,
  className = "",
  hover = true,
  glow = false,
  title,
}: CardProps) {
  return (
    <div
      data-aeonvera-card
      className={`
        relative overflow-hidden
        rounded-2xl
        border border-white/[0.06]
        bg-white/[0.02]
        backdrop-blur-xl

        transition-all duration-300

        ${hover ? "hover:translate-y-[-2px] hover:border-white/10 hover:bg-white/[0.03]" : ""}
        ${className}
      `}
    >
      {/* soft light layer */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500" />

      {/* gold accent (controlled) */}
      {glow && (
        <div className="absolute inset-0 bg-gradient-to-br from-[rgba(212,175,55,0.06)] to-transparent opacity-0 hover:opacity-100 transition-opacity duration-700" />
      )}

      {/* top edge */}
      <div className="absolute top-0 left-0 right-0 h-px bg-white/10" />

      <div className="relative z-10 p-6">
        {title && (
          <p className="text-[10px] tracking-[0.45em] uppercase text-white/35 mb-4">
            {title}
          </p>
        )}

        {children}
      </div>
    </div>
  );
}