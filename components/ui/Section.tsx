"use client";

import { ReactNode } from "react";

type SectionProps = {
  children: ReactNode;
  className?: string;
  intensity?: "low" | "medium" | "high";
  id?: string;
};

export default function Section({
  children,
  className = "",
  intensity = "medium",
  id,
}: SectionProps) {
  const spacing = {
    low: "py-24 md:py-28",
    medium: "py-32 md:py-40",
    high: "py-40 md:py-56",
  };

  return (
    <section
      id={id}
      data-aeonvera-section
      className={`
        relative w-full
        ${spacing[intensity]}
        ${className}
      `}
    >
      {/* ================================
          SOFT TOP FADE (SCROLL TRANSITION)
      ================================= */}
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/40 to-transparent" />

      {/* ================================
          CONTENT WRAPPER
      ================================= */}
      <div className="relative z-10 w-full">
        {children}
      </div>

      {/* ================================
          BOTTOM FADE (VISUAL CONTINUITY)
      ================================= */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/40 to-transparent" />
    </section>
  );
}