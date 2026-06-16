"use client";

import { useSyncExternalStore } from "react";

export type AeonOrbEnergy = "idle" | "showcase" | "summoned" | "listening" | "speaking";

type AeonOrbVisualProps = {
  className?: string;
  energy?: AeonOrbEnergy;
};

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(callback: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
}

export default function AeonOrbVisual({ className = "", energy = "idle" }: AeonOrbVisualProps) {
  const reduceMotion = usePrefersReducedMotion();

  // Three curated iridescent lines (gold · periwinkle · teal) — saturated so they
  // read in both light and dark. SMIL morphing is skipped under reduced-motion.
  const lines: Array<{ cls: string; dur: string; d: string; values: string }> = [
    {
      cls: "aeon-wave-line aeon-wave-line-gold",
      dur: "2.35s",
      d: "M8 60 C34 52 48 74 73 75 C105 76 119 31 149 32 C180 33 183 90 217 91 C249 92 256 47 286 46 C315 45 327 66 352 60",
      values:
        "M8 60 C34 52 48 74 73 75 C105 76 119 31 149 32 C180 33 183 90 217 91 C249 92 256 47 286 46 C315 45 327 66 352 60;M8 60 C35 70 52 51 78 48 C108 44 120 86 150 86 C181 86 188 34 220 33 C250 31 260 82 289 80 C317 77 329 50 352 60;M8 60 C36 49 51 80 82 82 C108 84 124 40 152 39 C184 38 191 86 219 87 C248 88 262 37 292 39 C319 41 331 73 352 60;M8 60 C34 52 48 74 73 75 C105 76 119 31 149 32 C180 33 183 90 217 91 C249 92 256 47 286 46 C315 45 327 66 352 60",
    },
    {
      cls: "aeon-wave-line aeon-wave-line-blue",
      dur: "2.75s",
      d: "M8 58 C38 43 58 41 88 58 C115 73 128 77 156 61 C180 47 192 44 220 61 C248 78 272 76 300 58 C320 45 337 51 352 58",
      values:
        "M8 58 C38 43 58 41 88 58 C115 73 128 77 156 61 C180 47 192 44 220 61 C248 78 272 76 300 58 C320 45 337 51 352 58;M8 58 C36 70 59 73 88 58 C116 43 132 39 158 57 C184 76 197 78 222 61 C247 45 274 42 300 58 C323 72 338 67 352 58;M8 58 C38 48 62 38 91 58 C118 77 132 80 158 62 C183 44 199 41 224 58 C249 74 274 77 302 58 C324 42 339 48 352 58;M8 58 C38 43 58 41 88 58 C115 73 128 77 156 61 C180 47 192 44 220 61 C248 78 272 76 300 58 C320 45 337 51 352 58",
    },
    {
      cls: "aeon-wave-line aeon-wave-line-green",
      dur: "3.25s",
      d: "M8 64 C42 70 60 86 92 65 C122 46 145 42 175 63 C206 84 232 82 262 63 C292 44 322 54 352 64",
      values:
        "M8 64 C42 70 60 86 92 65 C122 46 145 42 175 63 C206 84 232 82 262 63 C292 44 322 54 352 64;M8 62 C41 49 61 42 92 63 C123 84 146 82 176 62 C205 43 231 44 262 64 C292 84 323 76 352 62;M8 65 C40 82 63 82 94 63 C124 44 148 43 176 65 C205 87 230 84 262 62 C292 42 323 49 352 65;M8 64 C42 70 60 86 92 65 C122 46 145 42 175 63 C206 84 232 82 262 63 C292 44 322 54 352 64",
    },
    {
      cls: "aeon-wave-line aeon-wave-line-violet",
      dur: "3.7s",
      d: "M8 60 C42 66 68 80 98 61 C126 43 148 36 176 61 C204 86 227 84 258 62 C290 40 322 55 352 60",
      values:
        "M8 60 C42 66 68 80 98 61 C126 43 148 36 176 61 C204 86 227 84 258 62 C290 40 322 55 352 60;M8 60 C40 48 68 40 99 61 C128 82 150 85 176 61 C202 37 228 39 258 61 C289 82 323 72 352 60;M8 60 C43 76 69 82 100 60 C127 39 151 38 177 62 C203 86 229 84 259 60 C290 36 323 50 352 60;M8 60 C42 66 68 80 98 61 C126 43 148 36 176 61 C204 86 227 84 258 62 C290 40 322 55 352 60",
    },
  ];

  return (
    <span
      className={`aeon-wave-orb aeon-wave-orb-${energy} ${className}`}
      data-energy={energy}
      aria-hidden="true"
    >
      <span className="aeon-wave-glow aeon-wave-glow-teal" />
      <span className="aeon-wave-glow aeon-wave-glow-gold" />
      <span className="aeon-wave-translucent-orb" />
      <span className="aeon-wave-core" />
      <svg
        className="aeon-wave-field"
        viewBox="0 0 360 120"
        preserveAspectRatio="xMidYMid meet"
        focusable="false"
      >
        <defs>
          <linearGradient id="aeonWaveGold" x1="0%" x2="100%" y1="50%" y2="50%">
            <stop offset="0%" stopColor="rgba(255,236,174,0)" />
            <stop offset="14%" stopColor="rgba(255,224,150,0.5)" />
            <stop offset="50%" stopColor="rgba(255,231,158,0.95)" />
            <stop offset="86%" stopColor="rgba(255,224,150,0.5)" />
            <stop offset="100%" stopColor="rgba(255,236,174,0)" />
          </linearGradient>
          <linearGradient id="aeonWaveBlue" x1="0%" x2="100%" y1="50%" y2="50%">
            <stop offset="0%" stopColor="rgba(120,160,255,0)" />
            <stop offset="20%" stopColor="rgba(120,160,255,0.34)" />
            <stop offset="60%" stopColor="rgba(126,142,255,0.78)" />
            <stop offset="84%" stopColor="rgba(99,210,226,0.3)" />
            <stop offset="100%" stopColor="rgba(99,210,226,0)" />
          </linearGradient>
          <linearGradient id="aeonWaveGreen" x1="0%" x2="100%" y1="50%" y2="50%">
            <stop offset="0%" stopColor="rgba(113,229,210,0)" />
            <stop offset="32%" stopColor="rgba(113,229,210,0.5)" />
            <stop offset="68%" stopColor="rgba(255,224,150,0.42)" />
            <stop offset="100%" stopColor="rgba(255,224,150,0)" />
          </linearGradient>
          <linearGradient id="aeonWaveEdgeFade" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="black" />
            <stop offset="18%" stopColor="white" />
            <stop offset="82%" stopColor="white" />
            <stop offset="100%" stopColor="black" />
          </linearGradient>
          <mask id="aeonWaveFadeMask">
            <rect width="360" height="120" fill="url(#aeonWaveEdgeFade)" />
          </mask>
        </defs>
        <g className="aeon-wave-lines" mask="url(#aeonWaveFadeMask)">
          {lines.map((line) => (
            <path key={line.cls} className={line.cls} d={line.d}>
              {reduceMotion ? null : (
                <animate
                  attributeName="d"
                  dur={line.dur}
                  repeatCount="indefinite"
                  values={line.values}
                />
              )}
            </path>
          ))}
        </g>
      </svg>
    </span>
  );
}
