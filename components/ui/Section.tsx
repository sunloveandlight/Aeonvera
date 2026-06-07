"use client";

import { ReactNode } from "react";

type SectionProps = {
  children: ReactNode;
  className?: string;

  // NEW SYSTEM PROP
  intensity?: "low" | "medium" | "high";
};

export default function Section({
  children,
  className = "",
  intensity = "medium",
}: SectionProps) {
  const spacing = {
    low: "py-16 md:py-20",
    medium: "py-24 md:py-32",
    high: "py-32 md:py-44",
  };

  const intensityStyle = {
    low: "opacity-90",
    medium: "opacity-95",
    high: "opacity-100",
  };

  return (
    <section
      data-aeonvera-section
      className={`
        relative w-full
        ${spacing[intensity]}
        ${intensityStyle[intensity]}
        ${className}
      `}
    >
      {/* SUBTLE SYSTEM GRID ACCENT */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[radial-gradient(circle_at_center,white,transparent_70%)]" />

      <div className="relative z-10">
        {children}
      </div>
    </section>
  );
}