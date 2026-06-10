"use client";

import { useEffect, useState } from "react";

/**
 * Aeonvera Overlay Mode
 * Figma-style UI inspection layer
 */

export function useOverlayMode() {
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("aeonvera-overlay") === "true";
  });

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
      window.localStorage.setItem("aeonvera-overlay", "true");
    } else {
      document.body.classList.remove("aeonvera-overlay");
      window.localStorage.setItem("aeonvera-overlay", "false");
    }
  }, [enabled]);

  return {
    enabled,
    toggle: () => setEnabled((prev) => !prev),
  };
}
