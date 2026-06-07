"use client";

import { ReactNode } from "react";

type SectionTitleProps = {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: "left" | "center";
  className?: string;
};

export default function SectionTitle({
  eyebrow,
  title,
  subtitle,
  align = "left",
  className = "",
}: SectionTitleProps) {
  return (
    <div
      data-aeonvera-card
      className={`
        relative
        max-w-3xl
        ${align === "center" ? "mx-auto text-center" : ""}
        ${className}
      `}
    >
      {/* ================================
          EYEBROW (SYSTEM LABEL)
      ================================= */}
      {eyebrow && (
        <p className="text-[10px] uppercase tracking-[0.6em] text-white/25 mb-6">
          {eyebrow}
        </p>
      )}

      {/* ================================
          MAIN TITLE (FOCAL INTELLIGENCE)
      ================================= */}
      <h2
        className="
          text-4xl md:text-5xl lg:text-6xl
          font-light
          tracking-[-0.04em]
          leading-[1.05]
          text-white/90
        "
      >
        {title}
      </h2>

      {/* ================================
          SUBTITLE (CONTEXT LAYER)
      ================================= */}
      {subtitle && (
        <p className="mt-6 text-white/35 leading-relaxed font-light text-base md:text-lg">
          {subtitle}
        </p>
      )}
    </div>
  );
}