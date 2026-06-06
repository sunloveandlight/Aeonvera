"use client";

import Link from "next/link";
import { motion } from "framer-motion";

type ButtonProps = {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  className?: string;
};

export default function Button({
  children,
  href,
  onClick,
  variant = "primary",
  className = "",
}: ButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-medium transition-all relative overflow-hidden";

  const variants = {
    primary:
      "bg-white text-black hover:bg-white/90 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]",
    secondary:
      "bg-white/5 text-white border border-white/10 hover:border-white/20 hover:bg-white/10",
  };

  const content = (
    <motion.div
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.15 }}
      className={`
        ${baseStyles}
        ${variants[variant]}
        ${className}
      `}
    >
      {/* subtle glow layer */}
      <span className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-white/10 via-white/5 to-white/10" />

      <span className="relative">{children}</span>
    </motion.div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-block">
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className="inline-block">
      {content}
    </button>
  );
}