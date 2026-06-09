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
  hover = true,
}: CardProps) {
  return (
    <div
      data-aeonvera-card
      className={`
        premium-surface
        relative rounded-lg

        transition-all duration-500

        ${hover ? "hover:translate-y-[-2px] hover:border-[rgba(55,38,103,0.22)]" : ""}

        ${className}
      `}
    >
      {/* CONTENT */}
      <div className="relative z-10 p-6">

        {title && (
          <div className="mb-4 pb-3 border-b border-[rgba(36,50,74,0.1)]">
            <p className="text-[10px] uppercase tracking-normal text-[rgba(55,38,103,0.58)]">
              {title}
            </p>
          </div>
        )}

        {children}

      </div>
    </div>
  );
}
