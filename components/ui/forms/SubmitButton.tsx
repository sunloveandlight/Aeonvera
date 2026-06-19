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
      aria-busy={loading}
      className={`
        premium-action
        inline-flex w-full items-center justify-center
        h-11
        rounded-lg
        text-sm
        font-medium
        tracking-normal
        transition
        disabled:cursor-not-allowed
      `}
    >
      {loading ? "Processing..." : children}
    </button>
  );
}
