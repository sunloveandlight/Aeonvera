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
        executive-panel
        relative rounded-lg

        transition-all duration-500

        ${hover ? "quiet-lift" : ""}

        ${className}
      `}
    >
      {/* CONTENT */}
      <div className="relative z-10 p-6">

        {title && (
          <div className="mb-5 pb-3 border-b border-white/[0.06]">
            <p className="micro-label">
              {title}
            </p>
          </div>
        )}

        {children}

      </div>
    </div>
  );
}
