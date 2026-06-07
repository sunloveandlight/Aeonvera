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
        <label className="text-sm font-medium text-neutral-900 flex items-center gap-1">
          {label}
          {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {children}

      {hint && !error && (
        <p className="text-xs text-neutral-500">{hint}</p>
      )}

      {error && (
        <p className="text-xs text-red-500 animate-pulse">{error}</p>
      )}
    </div>
  );
}