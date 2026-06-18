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
    "relative inline-flex items-center justify-center rounded-md px-7 h-11 text-sm font-medium tracking-normal transition-all duration-300 select-none";

  const styles = {
    primary: `
      premium-button-primary
      hover:opacity-95
    `,
    secondary: `
      premium-button-secondary
    `,
  };

  const buttonClassName = `
    ${base}
    ${styles[variant]}
    ${disabled ? "opacity-40 cursor-not-allowed" : ""}
    ${className}
  `;

  if (href) {
    if (disabled) {
      return (
        <motion.span transition={{ duration: 0.2 }} className="inline-flex">
          <span
            aria-disabled="true"
            data-aeonvera-button
            className={buttonClassName}
          >
            <span className="relative z-10">{children}</span>
          </span>
        </motion.span>
      );
    }

    return (
      <motion.span transition={{ duration: 0.2 }} className="inline-flex">
        <Link
          href={href}
          data-aeonvera-button
          className={buttonClassName}
        >
          <span className="relative z-10">{children}</span>
        </Link>
      </motion.span>
    );
  }

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      transition={{ duration: 0.2 }}
      data-aeonvera-button
      className={buttonClassName}
    >
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
}
