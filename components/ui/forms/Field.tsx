"use client";
import React from "react";

type FieldProps = {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
};

export default function Field({
  label,
  hint,
  error,
  required,
  children,
  className = "",
}: FieldProps) {
  return (
    <div className={`w-full flex flex-col gap-1 ${className}`}>
      {label && (
        <label className="text-[10px] uppercase tracking-[0.14em] text-white/30 mb-2 flex items-center gap-1">
          {label}
          {required && <span className="text-red-400">*</span>}
        </label>
      )}
      {children}
      {hint && !error && (
        <p className="text-xs text-white/25 mt-1">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-red-400 mt-1">{error}</p>
      )}
    </div>
  );
}