"use client";
import React, { forwardRef } from "react";

export type SelectOption = {
  label: string;
  value: string;
};

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: SelectOption[];
  error?: boolean;
};

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, className = "", error, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={`
          w-full
          h-10
          px-3
          rounded-lg
          border
          text-sm
          bg-white/[0.03]
          text-white/80
          transition
          focus:outline-none
          focus:ring-1
          focus:ring-[#8b5cf6]/25
          focus:border-[#d6b765]
          ${error ? "border-red-500/50" : "border-white/[0.08]"}
          ${className}
        `}
        {...props}
      >
        {options.map((opt) => (
          <option
            key={opt.value}
            value={opt.value}
            className="bg-[#07070a] text-white/80"
          >
            {opt.label}
          </option>
        ))}
      </select>
    );
  }
);

Select.displayName = "Select";
export default Select;