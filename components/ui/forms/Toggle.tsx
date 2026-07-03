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
        <span className="text-sm text-[var(--text-3)]">{label}</span>
      )}
      <button
        type="button"
        onClick={() => onChange(!enabled)}
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        className={`
          w-10 h-6 flex items-center rounded-full p-1 transition-all duration-300
          ${enabled
            ? "border border-[var(--panel-border)] bg-[rgba(var(--gold),0.18)]"
            : "border border-[var(--panel-border)] bg-[var(--glass-fill)]"
          }
        `}
      >
        <div
          className={`
            w-4 h-4 rounded-full transition-all duration-300
            ${enabled
              ? "translate-x-4 bg-[rgb(var(--gold))] shadow-[0_0_18px_rgba(196,169,105,0.24)]"
              : "translate-x-0 bg-[var(--text-4)]"}
          `}
        />
      </button>
    </label>
  );
}
