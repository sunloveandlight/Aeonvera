"use client";

export type AeonOrbEnergy = "idle" | "showcase" | "summoned" | "listening" | "speaking";

type AeonOrbVisualProps = {
  className?: string;
  energy?: AeonOrbEnergy;
};

export default function AeonOrbVisual({ className = "", energy = "idle" }: AeonOrbVisualProps) {
  return (
    <span
      className={`aeon-wave-orb aeon-wave-orb-${energy} ${className}`}
      data-energy={energy}
      aria-hidden="true"
    >
      <span className="aeon-wave-glow aeon-wave-glow-teal" />
      <span className="aeon-wave-glow aeon-wave-glow-gold" />
      <span className="aeon-wave-core" />
      <svg
        className="aeon-wave-field"
        viewBox="0 0 360 120"
        preserveAspectRatio="xMidYMid meet"
        focusable="false"
      >
        <defs>
          <linearGradient id="aeonWaveGold" x1="0%" x2="100%" y1="50%" y2="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.72)" />
            <stop offset="26%" stopColor="rgba(255,236,174,0.72)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.92)" />
            <stop offset="74%" stopColor="rgba(255,236,174,0.7)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.72)" />
          </linearGradient>
          <linearGradient id="aeonWaveBlue" x1="0%" x2="100%" y1="50%" y2="50%">
            <stop offset="0%" stopColor="rgba(95,200,255,0.18)" />
            <stop offset="34%" stopColor="rgba(75,190,255,0.72)" />
            <stop offset="60%" stopColor="rgba(140,122,255,0.76)" />
            <stop offset="100%" stopColor="rgba(99,226,209,0.28)" />
          </linearGradient>
          <linearGradient id="aeonWaveGreen" x1="0%" x2="100%" y1="50%" y2="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="32%" stopColor="rgba(113,229,210,0.52)" />
            <stop offset="68%" stopColor="rgba(255,232,174,0.44)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.2)" />
          </linearGradient>
          <filter id="aeonWaveSoftGlow" x="-35%" y="-140%" width="170%" height="380%">
            <feGaussianBlur stdDeviation="3.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g className="aeon-wave-lines" filter="url(#aeonWaveSoftGlow)">
          <path
            className="aeon-wave-line aeon-wave-line-gold"
            d="M8 60 C34 52 48 74 73 75 C105 76 119 31 149 32 C180 33 183 90 217 91 C249 92 256 47 286 46 C315 45 327 66 352 60"
          />
          <path
            className="aeon-wave-line aeon-wave-line-blue"
            d="M8 58 C38 43 58 41 88 58 C115 73 128 77 156 61 C180 47 192 44 220 61 C248 78 272 76 300 58 C320 45 337 51 352 58"
          />
          <path
            className="aeon-wave-line aeon-wave-line-green"
            d="M8 64 C42 70 60 86 92 65 C122 46 145 42 175 63 C206 84 232 82 262 63 C292 44 322 54 352 64"
          />
          <path
            className="aeon-wave-line aeon-wave-line-white"
            d="M8 62 C48 57 70 54 108 61 C143 67 160 77 190 61 C221 45 250 53 286 61 C315 68 335 65 352 62"
          />
          <path
            className="aeon-wave-line aeon-wave-line-violet"
            d="M8 60 C42 66 68 80 98 61 C126 43 148 36 176 61 C204 86 227 84 258 62 C290 40 322 55 352 60"
          />
        </g>
      </svg>
    </span>
  );
}
