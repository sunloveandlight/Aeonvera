"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Mode = "light" | "dark";

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [mode, setMode] = useState<Mode | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("aeonvera.theme");
    if (stored === "light" || stored === "dark") {
      setMode(stored);
      return;
    }
    setMode(
      window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    );
  }, []);

  function toggle() {
    const next: Mode = mode === "dark" ? "light" : "dark";
    setMode(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem("aeonvera.theme", next);
    } catch {
      // Theme preference is a nicety, not required.
    }
  }

  const isDark = mode === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light theme" : "Dark theme"}
      className={`inline-flex size-8 items-center justify-center rounded-full border border-white/10 text-white/60 transition hover:text-white/90 ${className}`}
    >
      {/* Render the icon only after mount so it matches the resolved theme. */}
      {mode === null ? null : isDark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
