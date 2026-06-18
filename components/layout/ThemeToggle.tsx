"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

type Mode = "light" | "dark";

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const mode = useSyncExternalStore(subscribeToTheme, getInitialMode, getServerMode);

  function toggle() {
    const next: Mode = mode === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem("aeonvera.theme", next);
    } catch {
      // Theme preference is a nicety, not required.
    }
    window.dispatchEvent(new Event("aeonvera-theme-change"));
  }

  const isDark = mode === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light theme" : "Dark theme"}
      className={`inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full border border-transparent text-white/60 transition hover:text-white/90 ${className}`}
    >
      {isDark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}

function subscribeToTheme(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("aeonvera-theme-change", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("aeonvera-theme-change", onStoreChange);
  };
}

function getServerMode(): Mode {
  return "dark";
}

function getInitialMode(): Mode {
  if (typeof window === "undefined") return "dark";

  try {
    const stored = window.localStorage.getItem("aeonvera.theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Ignore storage restrictions and fall back to system preference.
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
