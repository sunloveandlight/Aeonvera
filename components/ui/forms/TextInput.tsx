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
          bg-white
          text-neutral-900
          placeholder:text-neutral-400
          transition
          focus:outline-none
          focus:ring-2
          focus:ring-black/10
          focus:border-black
          active:scale-[0.99]
          disabled:opacity-50
          disabled:cursor-not-allowed
          ${error ? "border-red-500" : "border-neutral-200"}
          ${className}
        `}
        {...props}
      />
    );
  }
);

TextInput.displayName = "TextInput";

export default TextInput;