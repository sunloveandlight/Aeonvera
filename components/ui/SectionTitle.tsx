"use client";

import { ReactNode } from "react";

type SectionTitleProps = {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: string;

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
      data-aeonvera-section-title
      className={`
        relative max-w-3xl
        ${align === "center" ? "mx-auto text-center" : ""}
        ${className}
      `}
    >
      {/* EYEBROW */}
      {eyebrow && (
        <p className="text-[10px] uppercase tracking-normal text-white/25 mb-6">
          {eyebrow}
        </p>
      )}

      {/* TITLE */}
      <h2 className="text-4xl md:text-5xl font-light tracking-normal text-white/90 leading-[1.1]">
        {title}
      </h2>

      {/* SUBTITLE */}
      {subtitle && (
        <p className="mt-6 text-white/40 leading-relaxed text-base md:text-lg">
          {subtitle}
        </p>
      )}
    </div>
  );
}