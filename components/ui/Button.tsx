"use client";

import Link from "next/link";
import { motion } from "framer-motion";

type ButtonProps = {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  className?: string;
  disabled?: boolean;
};

export default function Button({
  children,
  href,
  onClick,
  variant = "primary",
  className = "",
  disabled = false,
}: ButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-medium relative overflow-hidden transition-all select-none";

  const variants = {
    primary:
      "bg-white text-black hover:bg-white/90 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]",
    secondary:
      "bg-white/[0.04] text-white border border-white/10 hover:border-white/20 hover:bg-white/[0.08]",
  };

  const content = (
    <motion.div
      whileHover={disabled ? {} : { y: -1 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      transition={{ duration: 0.12, ease: "easeOut" }}
      className={`
        ${baseStyles}
        ${variants[variant]}
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        ${className}
      `}
      data-aeonvera-button
    >
      {/* glow layer (fixed: properly scoped) */}
      <span className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-white/10 via-white/5 to-white/10" />

      {/* content */}
      <span className="relative">{children}</span>
    </motion.div>
  );

  if (href) {
    return (
      <Link href={disabled ? "#" : href} className="inline-block">
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onClick} disabled={disabled} className="inline-block">
      {content}
    </button>
  );
}