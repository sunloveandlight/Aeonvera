import { ReactNode } from "react";
import { identity } from "@/lib/design/systemIdentity";

type Props = {
  children: ReactNode;
  variant?: "primary" | "secondary" | "tertiary" | "muted";
  className?: string;
};

export default function Text({
  children,
  variant = "primary",
  className = "",
}: Props) {
  const map = {
    primary: identity.hierarchy.primary,
    secondary: identity.hierarchy.secondary,
    tertiary: identity.hierarchy.tertiary,
    muted: identity.hierarchy.muted,
  };

  return (
    <span className={`${map[variant]} ${className}`}>
      {children}
    </span>
  );
}