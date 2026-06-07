import { ReactNode } from "react";

type SectionProps = {
  children: ReactNode;
  className?: string;

  // backward compatibility (old system)
  size?: "sm" | "md" | "lg" | "xl";

  // new design system (landing page)
  intensity?: "low" | "medium" | "high";
};

export default function Section({
  children,
  className = "",
  size,
  intensity,
}: SectionProps) {
  // PRIORITY: intensity overrides size if provided
  const value = intensity ?? "md";

  const sizeMap = {
    sm: "py-16",
    md: "py-24",
    lg: "py-32",
    xl: "py-40",
  };

  const intensityMap = {
    low: "py-20",
    medium: "py-28",
    high: "py-40",
  };

  const padding =
    intensity ? intensityMap[intensity] : sizeMap[(size as keyof typeof sizeMap) || "md"];

  return (
    <section className={`${padding} ${className}`}>
      {children}
    </section>
  );
}