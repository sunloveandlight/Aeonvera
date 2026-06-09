"use client";
import React from "react";

type CheckboxProps = {
  checked?: boolean;
  onChange?: (value: boolean) => void;
  label?: string;
  disabled?: boolean;
};

export default function Checkbox({
  checked,
  onChange,
  label,
  disabled,
}: CheckboxProps) {
  return (
    <label className="flex items-center gap-3 text-sm text-white/60 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="w-4 h-4 rounded border border-white/[0.08] bg-white/[0.03] accent-[#2997ff] cursor-pointer"
      />
      {label}
    </label>
  );
}