import { ReactNode } from "react";

type SectionProps = {
  children: ReactNode;
  className?: string;

  // compatibility (so nothing breaks)
  size?: "sm" | "md" | "lg" | "xl";
};

export default function Section({
  children,
  className = "",
  size = "md",
}: SectionProps) {
  const spacing = {
    sm: "py-16",
    md: "py-24",
    lg: "py-32",
    xl: "py-40",
  };

  return (
    <section className={`${spacing[size]} ${className}`}>
      {children}
    </section>
  );
}