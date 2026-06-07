"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ReactNode } from "react";
import { colors, motion as motionTokens, radius } from "@/lib/design/tokens";

type ButtonProps = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  variant?: "primary" | "secondary";
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
};

export default function Button({
  children,
  href,
  onClick,
  type = "button",
  variant = "primary",
  size = "md",
  className = "",
  disabled = false,
}: ButtonProps) {
  const sizes = {
    sm: "h-10 px-5 text-sm",
    md: "h-12 px-7 text-sm",
    lg: "h-14 px-9 text-base",
  };

  const base =
    "relative inline-flex items-center justify-center font-medium tracking-[0.02em] select-none cursor-pointer overflow-hidden transition-all backdrop-blur-xl";

  const variants = {
    primary: `
      bg-white
      text-black
      border border-white/10
      shadow-[0_0_0_1px_rgba(255,255,255,0.08)]
      hover:shadow-[0_20px_60px_rgba(0,0,0,0.45)]
      active:scale-[0.985]
    `,
    secondary: `
      bg-[${colors.white[5]}]
      text-white
      border border-white/10
      hover:bg-[${colors.white[10]}]
      hover:border-white/20
      active:scale-[0.985]
    `,
  };

  const content = (
    <motion.div
      whileHover={disabled ? {} : { y: -2 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      transition={{ duration: 0.18 }}
      data-aeonvera-button
      data-aeonvera-label="BUTTON"
      className={`
        ${base}
        ${sizes[size]}
        ${radius.lg}
        ${variants[variant]}
        ${disabled ? "opacity-40 cursor-not-allowed" : ""}
        ${className}
      `}
    >
      {/* LIGHT SHEEN */}
      <span
        className="
          absolute inset-0
          opacity-0 group-hover:opacity-100
          transition-opacity duration-500
          bg-gradient-to-r
          from-transparent via-white/10 to-transparent
        "
      />

      {/* TOP EDGE LIGHT */}
      <span className="absolute top-0 left-0 right-0 h-px bg-white/20" />

      {/* CONTENT */}
      <span className="relative z-10">{children}</span>
    </motion.div>
  );

  if (href) {
    return (
      <Link href={disabled ? "#" : href} className="inline-flex group">
        {content}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className="inline-flex group">
      {content}
    </button>
  );
}