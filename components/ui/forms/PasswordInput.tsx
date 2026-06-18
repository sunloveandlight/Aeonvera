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
          data-aeonvera-input
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
            focus:ring-[rgba(var(--gold),0.25)]
            focus:border-[rgba(var(--gold),0.62)]
            ${error ? "border-red-500/50" : "border-white/[0.08]"}
            ${className}
          `}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          aria-label={show ? "Hide password" : "Show password"}
          className="premium-inline-control absolute right-1.5 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-md text-[10px] uppercase tracking-[0.14em]"
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";
export default PasswordInput;
