"use client";
import React from "react";

type ToggleProps = {
  enabled: boolean;
  onChange: (value: boolean) => void;
  label?: string;
};

export default function Toggle({ enabled, onChange, label }: ToggleProps) {
  return (
    <label className="flex items-center justify-between w-full cursor-pointer">
      {label && (
        <span className="text-sm text-white/60">{label}</span>
      )}
      <button
        type="button"
        onClick={() => onChange(!enabled)}
        className={`
          w-10 h-6 flex items-center rounded-full p-1 transition-all duration-300
          ${enabled
            ? "border border-white/20 bg-white/[0.13]"
            : "bg-white/[0.06] border border-white/[0.08]"
          }
        `}
      >
        <div
          className={`
            w-4 h-4 rounded-full transition-all duration-300
            ${enabled ? "translate-x-4 bg-white/90 shadow-[0_0_18px_rgba(255,255,255,0.18)]" : "translate-x-0 bg-white/40"}
          `}
        />
      </button>
    </label>
  );
}
