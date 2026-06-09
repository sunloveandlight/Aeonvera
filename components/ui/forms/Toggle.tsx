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
            ? "bg-[#2997ff] border border-[#2997ff]/30"
            : "bg-white/[0.06] border border-white/[0.08]"
          }
        `}
      >
        <div
          className={`
            w-4 h-4 rounded-full transition-all duration-300
            ${enabled ? "translate-x-4 bg-white" : "translate-x-0 bg-white/40"}
          `}
        />
      </button>
    </label>
  );
}