"use client";

import { useDesignOverlay } from "@/lib/design/useDesignOverlay";

export default function DesignOverlayToggle() {
  const { enabled, toggle } = useDesignOverlay();

  return (
    <button
      onClick={toggle}
      className={`
        fixed bottom-5 left-5 z-[99999]
        px-4 py-2 rounded-md
        text-[10px] uppercase tracking-[0.14em]
        border border-white/10
        backdrop-blur-xl
        transition-all duration-300
        ${
          enabled
            ? "premium-action"
            : "premium-action-secondary"
        }
      `}
    >
      {enabled ? "Overlay ON" : "Overlay OFF"}
    </button>
  );
}
