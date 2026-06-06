"use client";

import { useEffect, useState } from "react";

/**
 * Aeonvera Overlay Mode
 * Figma-style UI inspection layer
 */

export function useOverlayMode() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const toggle = (e: KeyboardEvent) => {
      // Cmd + Shift + A (Mac-friendly dev toggle)
      if (e.metaKey && e.shiftKey && e.key.toLowerCase() === "a") {
        setEnabled((prev) => !prev);
      }
    };

    window.addEventListener("keydown", toggle);
    return () => window.removeEventListener("keydown", toggle);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    if (enabled) {
      document.body.classList.add("aeonvera-overlay");
    } else {
      document.body.classList.remove("aeonvera-overlay");
    }
  }, [enabled]);

  return enabled;
}