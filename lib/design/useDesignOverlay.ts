"use client";

import { useEffect, useState } from "react";

const getInitialOverlayState = () => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("aeonvera-overlay") === "true";
};

export function useDesignOverlay() {
  const [enabled, setEnabled] = useState(getInitialOverlayState);

  useEffect(() => {
    if (enabled) {
      document.body.classList.add("aeonvera-design-overlay");
    } else {
      document.body.classList.remove("aeonvera-design-overlay");
    }
  }, [enabled]);

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
