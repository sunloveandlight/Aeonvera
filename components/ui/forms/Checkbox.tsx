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
    <label className="flex items-center gap-2 text-sm text-neutral-900 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="w-4 h-4 accent-black"
      />
      {label}
    </label>
  );
}