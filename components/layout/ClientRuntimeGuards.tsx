"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    __aeonveraExternalNavigation?: boolean;
  }
}

export default function ClientRuntimeGuards() {
  useEffect(() => {
    function isBenignExternalNavigationError(reason: unknown) {
      if (!window.__aeonveraExternalNavigation) return false;

      const message =
        reason instanceof Error
          ? `${reason.name}: ${reason.message}\n${reason.stack || ""}`
          : String(reason || "");

      return message.includes("Failed to fetch");
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      if (isBenignExternalNavigationError(event.reason)) {
        event.preventDefault();
      }
    }

    function onError(event: ErrorEvent) {
      if (isBenignExternalNavigationError(event.error || event.message)) {
        event.preventDefault();
      }
    }

    window.addEventListener("unhandledrejection", onUnhandledRejection);
    window.addEventListener("error", onError);

    return () => {
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      window.removeEventListener("error", onError);
    };
  }, []);

  return null;
}
