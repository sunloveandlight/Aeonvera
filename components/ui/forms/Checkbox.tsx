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
    <label className="flex items-center gap-3 text-sm text-[var(--text-2)] cursor-pointer">
      <input
        data-aeonvera-input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="w-4 h-4 rounded border border-[var(--panel-border)] bg-[var(--panel-2)] accent-[rgb(var(--gold))] cursor-pointer"
      />
      {label}
    </label>
  );
}
