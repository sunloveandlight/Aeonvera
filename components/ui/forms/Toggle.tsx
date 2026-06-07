"use client";

import React from "react";

type ToggleProps = {
  enabled: boolean;
  onChange: (value: boolean) => void;
  label?: string;
};

export default function Toggle({
  enabled,
  onChange,
  label,
}: ToggleProps) {
  return (
    <label className="flex items-center justify-between w-full cursor-pointer">
      {label && (
        <span className="text-sm text-neutral-900">{label}</span>
      )}

      <button
        type="button"
        onClick={() => onChange(!enabled)}
        className={`
          w-10 h-6 flex items-center rounded-full p-1 transition
          ${enabled ? "bg-black" : "bg-neutral-300"}
        `}
      >
        <div
          className={`
            w-4 h-4 bg-white rounded-full transition
            ${enabled ? "translate-x-4" : "translate-x-0"}
          `}
        />
      </button>
    </label>
  );
}