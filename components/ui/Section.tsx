"use client";

import { FadeIn } from "@/components/motion/Motion";

type SectionProps = {
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  id?: string;
  label?: string;
};

const sizes = {
  sm: "py-16",
  md: "py-24",
  lg: "py-32",
  xl: "py-40",
};

export default function Section({
  children,
  className = "",
  size = "lg",
  id,
  label,
}: SectionProps) {
  return (
    <section
      id={id}
      data-aeonvera-label={label || "Section"}
      className={`w-full ${sizes[size]} ${className}`}
    >
      <div className="mx-auto max-w-7xl px-6">
        <FadeIn>{children}</FadeIn>
      </div>
    </section>
  );
}