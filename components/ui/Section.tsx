import { ReactNode } from "react";
import { space } from "@/lib/design/tokens";

type Props = {
  children: ReactNode;
  className?: string;
  size?: keyof typeof space.section;
};

export default function Section({
  children,
  className = "",
  size = "md",
}: Props) {
  return (
    <section className={`${space.section[size]} ${className}`}>
      {children}
    </section>
  );
}