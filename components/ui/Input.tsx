"use client";

import { motion } from "framer-motion";

type InputProps = {
  label?: string;
  placeholder?: string;
  type?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export default function Input({
  label,
  placeholder,
  type = "text",
  value,
  onChange,
}: InputProps) {
  return (
    <div className="w-full space-y-2">
      {label && (
        <div className="text-xs uppercase tracking-[0.3em] text-white/40">
          {label}
        </div>
      )}

      <motion.input
        whileFocus={{ scale: 1.01 }}
        transition={{ duration: 0.15 }}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="
          w-full
          rounded-xl
          bg-white/[0.03]
          border border-white/10
          px-4 py-3
          text-white/90
          placeholder:text-white/30
          outline-none
          focus:border-white/25
          transition-all
        "
      />
    </div>
  );
}