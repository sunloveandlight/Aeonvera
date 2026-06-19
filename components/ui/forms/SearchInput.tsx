"use client";
import React, { forwardRef } from "react";

export type SearchInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  onClear?: () => void;
  error?: boolean;
};

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className = "", onClear, error, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <input
          ref={ref}
          data-aeonvera-input
          type="search"
          className={`
            w-full
            h-11
            pl-10
            pr-10
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
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-xs">
          ⌕
        </div>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear search"
            className="premium-inline-control absolute right-2 top-1/2 inline-flex min-h-8 min-w-8 -translate-y-1/2 items-center justify-center rounded-md text-xs"
          >
            ✕
          </button>
        )}
      </div>
    );
  }
);

SearchInput.displayName = "SearchInput";
export default SearchInput;
