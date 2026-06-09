"use client";
import React from "react";

type SubmitButtonProps = {
  children: React.ReactNode;
  loading?: boolean;
};

export default function SubmitButton({ children, loading }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={loading}
      className={`
        w-full
        h-10
        rounded-lg
        text-sm
        font-light
        tracking-normal
        uppercase
        transition-all
        duration-300
        active:scale-[0.98]
        ${
          loading
            ? "bg-white/10 text-white/30 cursor-not-allowed"
            : "premium-action"
        }
      `}
    >
      {loading ? "Processing..." : children}
    </button>
  );
}
