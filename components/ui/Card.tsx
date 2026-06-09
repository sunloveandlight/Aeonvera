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
        premium-surface
        relative rounded-lg

        transition-all duration-500

        ${hover ? "hover:translate-y-[-2px] hover:border-white/15" : ""}

        ${className}
      `}
    >
      {/* GOLD FIELD (CONTROLLED ENERGY) */}
      {glow && (
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(212,175,55,0.7),rgba(143,184,255,0.45),transparent)]" />
      )}

      {/* CONTENT */}
      <div className="relative z-10 p-6">

        {title && (
          <div className="mb-4 pb-3 border-b border-white/5">
            <p className="text-[10px] uppercase tracking-normal text-white/30">
              {title}
            </p>
          </div>
        )}

        {children}

      </div>
    </div>
  );
}
