"use client";

import React, { useState, forwardRef } from "react";

export type PasswordInputProps =
  React.InputHTMLAttributes<HTMLInputElement> & {
    error?: boolean;
  };

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className = "", error, ...props }, ref) => {
    const [show, setShow] = useState(false);

    return (
      <div className="relative w-full">
        <input
          ref={ref}
          type={show ? "text" : "password"}
          className={`
            w-full
            h-10
            px-3
            pr-12
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
            ${error ? "border-red-500" : "border-neutral-200"}
            ${className}
          `}
          {...props}
        />

        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-neutral-500 hover:text-neutral-900 transition"
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";

export default PasswordInput;