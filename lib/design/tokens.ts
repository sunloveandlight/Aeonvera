// Single source of truth for the champagne accent: rgb(196, 169, 105) === #c4a969.
// Must stay in sync with `--gold` / `--royal` in app/globals.css.
export const colors = {
  bg: "#000000",

  white: {
    100: "rgba(255,255,255,0.95)",
    80: "rgba(255,255,255,0.8)",
    60: "rgba(255,255,255,0.6)",
    40: "rgba(255,255,255,0.4)",
    25: "rgba(255,255,255,0.25)",
    15: "rgba(255,255,255,0.15)",
    10: "rgba(255,255,255,0.1)",
    5: "rgba(255,255,255,0.05)",
  },

  gold: {
    100: "rgba(196,169,105,1)",
    70: "rgba(196,169,105,0.7)",
    40: "rgba(196,169,105,0.4)",
    20: "rgba(196,169,105,0.2)",
    10: "rgba(196,169,105,0.1)",
    5: "rgba(196,169,105,0.05)",
  },
};

/* ================================
   SPACING SYSTEM (NEW CORE RULE)
================================ */

export const space = {
  section: {
    xs: "py-16 md:py-20",
    sm: "py-20 md:py-24",
    md: "py-28 md:py-32",
    lg: "py-36 md:py-40",
    xl: "py-44 md:py-52",
  },

  stack: {
    xs: "space-y-3",
    sm: "space-y-5",
    md: "space-y-8",
    lg: "space-y-12",
    xl: "space-y-16",
  },

  container: {
    page: "max-w-7xl mx-auto px-6 lg:px-8",
    narrow: "max-w-3xl mx-auto px-6 lg:px-8",
  },
};

/* ================================
   TYPOGRAPHY IDENTITY (REFINED)
================================ */

export const type = {
  hero: "text-5xl md:text-7xl font-light tracking-[-0.022em] leading-[1.05]",
  title: "text-3xl md:text-5xl font-light tracking-[-0.018em] leading-[1.1]",
  subtitle: "text-lg md:text-xl text-white/40 leading-relaxed",
  body: "text-base text-white/45 leading-relaxed",
  small: "text-sm text-white/35",
  micro: "text-[10px] tracking-[0.45em] uppercase text-white/25",
};

/* ================================
   DESIGN MOTION SYSTEM
================================ */

export const motion = {
  fast: "duration-150",
  normal: "duration-300",
  slow: "duration-500",
};

/* ================================
   BORDER RADIUS SYSTEM
================================ */

export const radius = {
  sm: "rounded-xl",
  md: "rounded-2xl",
  lg: "rounded-3xl",
};

/* ================================
   SHADOW SYSTEM
================================ */

export const shadow = {
  soft: "shadow-[0_10px_40px_rgba(0,0,0,0.35)]",
  medium: "shadow-[0_20px_60px_rgba(0,0,0,0.5)]",
  glow: "shadow-[0_0_30px_rgba(196,169,105,0.12)]",
};