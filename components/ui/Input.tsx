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
    <div className="w-full space-y-2" data-aeonvera-input>
      {label && (
        <div className="text-[11px] uppercase tracking-[0.28em] text-white/40">
          {label}
        </div>
      )}

      <motion.input
        whileFocus={{ scale: 1.015 }}
        transition={{ duration: 0.12, ease: "easeOut" }}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="
          w-full
          rounded-xl
          bg-white/[0.04]
          border border-white/10
          px-4 py-3
          text-white/90
          placeholder:text-white/25
          outline-none
          transition-all
          duration-200

          focus:border-white/25
          focus:bg-white/[0.05]
          focus:ring-2
          focus:ring-white/5
        "
      />
    </div>
  );
}