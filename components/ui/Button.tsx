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
    sm: "h-10 px-5 text-[10px]",
    md: "h-12 px-7 text-[10px]",
    lg: "h-14 px-9 text-[11px]",
  };

  const variants = {
    primary: `
      bg-gradient-to-b from-[rgba(212,175,55,0.15)] to-[rgba(180,140,60,0.08)]
      text-[rgba(212,175,55,0.95)]
      border border-[rgba(212,175,55,0.3)]
      hover:border-[rgba(212,175,55,0.55)]
      hover:from-[rgba(212,175,55,0.22)] hover:to-[rgba(180,140,60,0.12)]
      hover:shadow-[0_0_35px_rgba(212,175,55,0.12)]
      active:scale-[0.985]
    `,
    secondary: `
      bg-transparent
      text-white/40
      border border-white/[0.08]
      hover:border-white/20
      hover:text-white/60
      hover:bg-white/[0.03]
      active:scale-[0.985]
    `,
  };

  const inner = (
    <motion.div
      whileHover={disabled ? {} : { y: -1 }}
      whileTap={disabled ? {} : { scale: 0.985 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
      data-aeonvera-button
      data-aeonvera-label="BUTTON"
      className={`
        group
        relative
        inline-flex
        items-center
        justify-center
        rounded-full
        overflow-hidden
        font-light
        tracking-[0.35em]
        uppercase
        transition-all
        duration-300
        select-none
        cursor-pointer
        ${sizes[size]}
        ${variants[variant]}
        ${disabled ? "opacity-30 cursor-not-allowed" : ""}
        ${className}
      `}
    >
      {/* gold shimmer on hover */}
      <span
        className="
          absolute
          inset-0
          opacity-0
          group-hover:opacity-100
          transition-opacity
          duration-700
          bg-gradient-to-r
          from-transparent
          via-[rgba(212,175,55,0.08)]
          to-transparent
        "
      />

      {/* top edge highlight */}
      <span
        className="
          absolute
          inset-x-0
          top-0
          h-px
          bg-gradient-to-r
          from-transparent
          via-[rgba(212,175,55,0.4)]
          to-transparent
        "
      />

      {/* content */}
      <span className="relative z-10">{children}</span>
    </motion.div>
  );

  if (href) {
    return (
      <Link href={disabled ? "#" : href} className="inline-flex">
        {inner}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className="inline-flex">
      {inner}
    </button>
  );
}