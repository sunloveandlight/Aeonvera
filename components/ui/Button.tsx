"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ReactNode } from "react";

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

  const variants = {
    primary: `
      bg-white
      text-black
      border border-white/10
      shadow-[0_0_0_1px_rgba(255,255,255,0.08)]
      hover:shadow-[0_10px_40px_rgba(255,255,255,0.10)]
      hover:bg-white/95
      active:scale-[0.985]
      transition-all
    `,
    secondary: `
      bg-white/[0.03]
      text-white
      border border-white/10
      hover:bg-white/[0.06]
      hover:border-white/20
      hover:shadow-[0_0_30px_rgba(212,175,55,0.08)]
      active:scale-[0.985]
      transition-all
    `,
  };

  const inner = (
    <motion.div
      whileHover={disabled ? {} : { y: -2 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      data-aeonvera-button
      data-aeonvera-label="BUTTON"
      className={`
        relative
        inline-flex
        items-center
        justify-center
        rounded-2xl
        font-medium
        tracking-[0.02em]
        select-none
        cursor-pointer
        overflow-hidden

        backdrop-blur-xl

        ${sizes[size]}
        ${variants[variant]}
        ${disabled ? "opacity-40 cursor-not-allowed" : ""}

        ${className}
      `}
    >
      {/* ================================
          LIGHT SHEEN (ANGLE HIGHLIGHT)
      ================================= */}
      <span
        className="
          absolute inset-0
          opacity-0
          group-hover:opacity-100
          transition-opacity duration-500
          bg-gradient-to-r
          from-transparent
          via-white/10
          to-transparent
          blur-sm
        "
      />

      {/* ================================
          TOP EDGE LIGHT (PHYSICAL SURFACE)
      ================================= */}
      <span
        className="
          absolute top-0 left-0 right-0
          h-px
          bg-gradient-to-r
          from-transparent
          via-white/25
          to-transparent
        "
      />

      {/* ================================
          GOLD ACCENT (SUBTLE ENERGY LAYER)
      ================================= */}
      <span
        className="
          absolute inset-0
          opacity-0
          group-hover:opacity-100
          transition-opacity duration-700
          bg-gradient-to-br
          from-[rgba(212,175,55,0.08)]
          via-transparent
          to-transparent
        "
      />

      {/* CONTENT */}
      <span className="relative z-10">{children}</span>
    </motion.div>
  );

  if (href) {
    return (
      <Link href={disabled ? "#" : href} className="inline-flex group">
        {inner}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className="inline-flex group">
      {inner}
    </button>
  );
}