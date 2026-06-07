"use client";

import React, { forwardRef } from "react";

export type TextareaProps =
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
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
          bg-white
          text-neutral-900
          placeholder:text-neutral-400
          transition
          resize-y
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

Textarea.displayName = "Textarea";

export default Textarea;