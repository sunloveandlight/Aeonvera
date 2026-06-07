"use client";

import React, { forwardRef } from "react";

export type SearchInputProps =
  React.InputHTMLAttributes<HTMLInputElement> & {
    onClear?: () => void;
    error?: boolean;
  };

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className = "", onClear, error, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <input
          ref={ref}
          type="search"
          className={`
            w-full
            h-10
            pl-10
            pr-10
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

        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
          🔍
        </div>

        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-900"
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