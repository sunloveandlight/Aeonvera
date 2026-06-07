import { ReactNode } from "react";
import { space } from "@/lib/design/tokens";

type Props = {
  children: ReactNode;
  className?: string;
  variant?: "page" | "narrow";
};

export default function PageContainer({
  children,
  className = "",
  variant = "page",
}: Props) {
  return (
    <div className={`${space.container[variant]} ${className}`}>
      {children}
    </div>
  );
}