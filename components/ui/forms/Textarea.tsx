"use client";
import React, { forwardRef } from "react";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  error?: boolean;
};

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={`
          w-full
          min-h-[100px]
          px-3
          py-2
          rounded-lg
          border
          text-sm
          bg-white/[0.03]
          text-white/80
          placeholder:text-white/20
          transition
          resize-y
          focus:outline-none
          focus:ring-1
          focus:ring-[#2997ff]/25
          focus:border-[#2997ff]/30
          ${error ? "border-red-500/50" : "border-white/[0.08]"}
          ${className}
        `}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";
export default Textarea;