import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  variant?: "page" | "narrow";
};

const containerVariants = {
  page: "max-w-7xl mx-auto px-6 lg:px-8",
  narrow: "max-w-3xl mx-auto px-6 lg:px-8",
};

export default function PageContainer({
  children,
  className = "",
  variant = "page",
}: Props) {
  return (
    <div className={`${containerVariants[variant]} ${className}`}>
      {children}
    </div>
  );
}