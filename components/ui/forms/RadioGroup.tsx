"use client";
import React from "react";

type Option = {
  label: string;
  value: string;
};

type RadioGroupProps = {
  value?: string;
  onChange?: (value: string) => void;
  options: Option[];
  name: string;
};

export default function RadioGroup({
  value,
  onChange,
  options,
  name,
}: RadioGroupProps) {
  return (
    <div className="flex flex-col gap-3">
      {options.map((opt) => (
        <label
          key={opt.value}
          className="flex items-center gap-3 text-sm text-white/60 cursor-pointer"
        >
          <input
            data-aeonvera-input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange?.(opt.value)}
            className="accent-[rgb(var(--gold))]"
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}
