"use client";
import React from "react";

type FieldProps = {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
};

export default function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className = "",
}: FieldProps) {
  const generatedId = React.useId();
  const fieldId = htmlFor ?? generatedId;
  const errorId = error ? `${fieldId}-error` : undefined;
  const hintId = hint && !error ? `${fieldId}-hint` : undefined;
  const describedBy = errorId ?? hintId;

  // Associate the label/aria with the control without requiring every call site
  // to thread an id — the form inputs all spread props onto their underlying element.
  const describedProps = {
    id: fieldId,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
  };
  const control = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, describedProps)
    : children;

  return (
    <div className={`w-full flex flex-col gap-1 ${className}`}>
      {label && (
        <label
          htmlFor={fieldId}
          className="text-[10px] uppercase tracking-[0.14em] text-white/30 mb-2 flex items-center gap-1"
        >
          {label}
          {required && <span className="text-red-400">*</span>}
        </label>
      )}
      {control}
      {hint && !error && (
        <p id={hintId} className="text-xs text-white/25 mt-1">{hint}</p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-400 mt-1">{error}</p>
      )}
    </div>
  );
}
