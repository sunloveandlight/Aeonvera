"use client";

import { useEffect, useState } from "react";

export function useDesignOverlay() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("aeonvera-overlay");
    if (saved === "true") {
      setEnabled(true);
      document.body.classList.add("aeonvera-design-overlay");
    }
  }, []);

  const toggle = () => {
    setEnabled((prev) => {
      const next = !prev;

      if (next) {
        document.body.classList.add("aeonvera-design-overlay");
        localStorage.setItem("aeonvera-overlay", "true");
      } else {
        document.body.classList.remove("aeonvera-design-overlay");
        localStorage.setItem("aeonvera-overlay", "false");
      }

      return next;
    });
  };

  return {
    enabled,
    toggle,
  };
}