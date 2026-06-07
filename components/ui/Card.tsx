"use client";

import { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
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
        relative overflow-hidden rounded-2xl

        /* BASE MATERIAL */
        bg-[rgba(255,255,255,0.02)]
        border border-white/[0.06]

        /* DEPTH STACK */
        shadow-[0_10px_40px_rgba(0,0,0,0.35)]
        backdrop-blur-xl

        transition-all duration-500

        ${hover ? "hover:translate-y-[-3px] hover:border-white/10 hover:shadow-[0_25px_80px_rgba(0,0,0,0.55)]" : ""}

        ${className}
      `}
    >

      {/* LIGHT REFLECTION LAYER */}
      <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-700 bg-gradient-to-br from-white/[0.05] via-transparent to-transparent pointer-events-none" />

      {/* GOLD FIELD (CONTROLLED ENERGY) */}
      {glow && (
        <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-700 bg-gradient-to-br from-[rgba(212,175,55,0.07)] via-transparent to-transparent pointer-events-none" />
      )}

      {/* TOP EDGE LIGHT (PHYSICAL HINT) */}
      <div className="absolute top-0 left-0 right-0 h-px bg-white/10" />

      {/* CONTENT */}
      <div className="relative z-10 p-6">

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