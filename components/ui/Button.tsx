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
    sm: "h-10 px-4 text-sm",
    md: "h-12 px-6 text-sm",
    lg: "h-14 px-8 text-base",
  };

  const variants = {
    primary:
      `
      bg-white
      text-black
      border border-white/10

      hover:bg-white/95
      hover:shadow-[0_0_30px_rgba(255,255,255,0.12)]

      active:scale-[0.985]
      `,

    secondary:
      `
      bg-white/[0.04]
      text-white
      border border-white/10

      hover:bg-white/[0.07]
      hover:border-white/20
      hover:shadow-[0_0_25px_rgba(255,255,255,0.05)]

      active:scale-[0.985]
      `,
  };

  const inner = (
    <motion.div
      whileHover={disabled ? {} : { y: -1 }}
      whileTap={disabled ? {} : { scale: 0.985 }}
      transition={{
        duration: 0.16,
        ease: "easeOut",
      }}
      data-aeonvera-button
      data-aeonvera-label="BUTTON"
      className={`
        group
        relative
        inline-flex
        items-center
        justify-center

        rounded-2xl
        overflow-hidden

        font-medium
        tracking-[0.01em]

        transition-all
        duration-300

        select-none
        cursor-pointer

        ${sizes[size]}
        ${variants[variant]}

        ${disabled ? "opacity-40 cursor-not-allowed" : ""}

        ${className}
      `}
    >
      {/* glow */}

      <span
        className="
          absolute
          inset-0
          opacity-0
          group-hover:opacity-100
          transition-opacity
          duration-500

          bg-gradient-to-r
          from-transparent
          via-white/10
          to-transparent
        "
      />

      {/* subtle top highlight */}

      <span
        className="
          absolute
          inset-x-0
          top-0
          h-px
          bg-white/20
        "
      />

      {/* content */}

      <span className="relative z-10">
        {children}
      </span>
    </motion.div>
  );

  if (href) {
    return (
      <Link
        href={disabled ? "#" : href}
        className="inline-flex"
      >
        {inner}
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex"
    >
      {inner}
    </button>
  );
}