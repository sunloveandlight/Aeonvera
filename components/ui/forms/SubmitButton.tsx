"use client";

import React from "react";

type SubmitButtonProps = {
  children: React.ReactNode;
  loading?: boolean;
};

export default function SubmitButton({
  children,
  loading,
}: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={loading}
      className={`
        w-full
        h-10
        rounded-lg
        text-sm
        font-medium
        transition
        active:scale-[0.98]
        ${
          loading
            ? "bg-neutral-300 text-neutral-500"
            : "bg-black text-white hover:opacity-90"
        }
      `}
    >
      {loading ? "Loading..." : children}
    </button>
  );
}