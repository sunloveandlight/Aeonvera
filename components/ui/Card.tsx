"use client";

import { HoverLift } from "@/components/motion/Motion";

type CardProps = {
  children: React.ReactNode;
  className?: string;
  title?: string;
  label?: string;
};

export default function Card({
  children,
  className = "",
  title,
  label,
}: CardProps) {
  return (
    <HoverLift>
      <div
        className={`
          relative
          rounded-2xl
          border border-white/10
          bg-white/[0.03]
          backdrop-blur-xl
          p-6
          transition-colors
          hover:border-white/20
          ${className}
        `}
      >
        {label && (
          <div className="text-xs uppercase tracking-[0.35em] text-white/40 mb-3">
            {label}
          </div>
        )}

        {title && (
          <h3 className="text-xl font-semibold text-white mb-3">
            {title}
          </h3>
        )}

        <div className="text-white/60 leading-relaxed">
          {children}
        </div>
      </div>
    </HoverLift>
  );
}