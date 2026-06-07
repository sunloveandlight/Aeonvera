"use client";

import React, { forwardRef } from "react";

export type NumberInputProps =
  React.InputHTMLAttributes<HTMLInputElement> & {
    error?: boolean;
  };

const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className = "", error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="number"
        className={`
          w-full
          h-10
          px-3
          rounded-lg
          border
          text-sm
          bg-white
          text-neutral-900
          placeholder:text-neutral-400
          transition
          focus:outline-none
          focus:ring-2
          focus:ring-black/10
          focus:border-black
          ${error ? "border-red-500" : "border-neutral-200"}
          ${className}
        `}
        {...props}
      />
    );
  }
);

NumberInput.displayName = "NumberInput";

export default NumberInput;