"use client";

import { useDesignOverlay } from "@/lib/design/useDesignOverlay";

export default function DesignOverlayToggle() {
  const { enabled, toggle } = useDesignOverlay();

  return (
    <button
      onClick={toggle}
      className={`
        fixed bottom-5 left-5 z-[99999]
        px-4 py-2 rounded-full
        text-[10px] uppercase tracking-[0.3em]
        border border-white/10
        backdrop-blur-xl
        transition-all duration-300
        ${
          enabled
            ? "bg-white text-black"
            : "bg-black/60 text-white/60 hover:text-white"
        }
      `}
    >
      {enabled ? "Overlay ON" : "Overlay OFF"}
    </button>
  );
}