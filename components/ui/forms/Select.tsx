"use client";

import React, { forwardRef } from "react";

export type SelectOption = {
  label: string;
  value: string;
};

export type SelectProps =
  React.SelectHTMLAttributes<HTMLSelectElement> & {
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
          bg-white
          text-neutral-900
          transition
          focus:outline-none
          focus:ring-2
          focus:ring-black/10
          focus:border-black
          ${error ? "border-red-500" : "border-neutral-200"}
          ${className}
        `}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }
);

Select.displayName = "Select";

export default Select;