"use client";
import React, { forwardRef } from "react";

export type TextInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  error?: boolean;
};

const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ className = "", error, ...props }, ref) => {
    return (
      <input
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
          placeholder:text-white/20
          transition
          focus:outline-none
          focus:ring-1
          focus:ring-[#8b5cf6]/25
          focus:border-[#d6b765]
          active:scale-[0.99]
          disabled:opacity-50
          disabled:cursor-not-allowed
          ${error ? "border-red-500/50" : "border-white/[0.08]"}
          ${className}
        `}
        {...props}
      />
    );
  }
);

TextInput.displayName = "TextInput";
export default TextInput;