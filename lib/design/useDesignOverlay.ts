"use client";

import { useEffect, useState } from "react";

export function useDesignOverlay() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("aeonvera-design-overlay");
    if (stored === "true") setEnabled(true);
  }, []);

  useEffect(() => {
    const root = document.documentElement;

    if (enabled) {
      root.classList.add("aeonvera-design-overlay");
      localStorage.setItem("aeonvera-design-overlay", "true");
    } else {
      root.classList.remove("aeonvera-design-overlay");
      localStorage.setItem("aeonvera-design-overlay", "false");
    }
  }, [enabled]);

  const toggle = () => setEnabled((v) => !v);

  return { enabled, toggle };
}