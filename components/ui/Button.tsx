"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { motion } from "framer-motion";

type ButtonProps = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  variant?: "primary" | "secondary";
  disabled?: boolean;
  className?: string;
};

export default function Button({
  children,
  href,
  onClick,
  type = "button",
  variant = "primary",
  disabled = false,
  className = "",
}: ButtonProps) {
  const base =
    "relative inline-flex items-center justify-center rounded-md px-7 h-12 text-sm font-medium tracking-normal transition-all duration-300 select-none";

  const styles = {
    primary: `
      premium-button-primary
      hover:brightness-95
      active:scale-[0.985]
    `,
    secondary: `
      premium-button-secondary
      hover:border-white/20
      active:scale-[0.985]
    `,
  };

  const content = (
    <motion.div
      whileHover={disabled ? {} : { y: -1 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      transition={{ duration: 0.2 }}
      data-aeonvera-button
      className={`
        ${base}
        ${styles[variant]}
        ${disabled ? "opacity-40 cursor-not-allowed" : ""}
        ${className}
      `}
    >
      {/* content */}
      <span className="relative z-10">{children}</span>
    </motion.div>
  );

  if (href) {
    return (
      <Link href={disabled ? "#" : href} className="inline-flex">
        {content}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled}>
      {content}
    </button>
  );
}
