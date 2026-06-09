"use client";
import React, { useState, forwardRef } from "react";

export type PasswordInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
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
            bg-white/[0.03]
            text-white/80
            placeholder:text-white/20
            transition
            focus:outline-none
            focus:ring-1
            focus:ring-[#8b5cf6]/25
            focus:border-[#d6b765]
            active:scale-[0.99]
            ${error ? "border-red-500/50" : "border-white/[0.08]"}
            ${className}
          `}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-[0.14em] text-white/30 hover:text-white/60 transition"
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";
export default PasswordInput;