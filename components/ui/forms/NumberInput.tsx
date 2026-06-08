"use client";
import React, { forwardRef } from "react";

export type NumberInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
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
          bg-white/[0.03]
          text-white/80
          placeholder:text-white/20
          transition
          focus:outline-none
          focus:ring-1
          focus:ring-[rgba(212,175,55,0.3)]
          focus:border-[rgba(212,175,55,0.3)]
          ${error ? "border-red-500/50" : "border-white/[0.08]"}
          ${className}
        `}
        {...props}
      />
    );
  }
);

NumberInput.displayName = "NumberInput";
export default NumberInput;