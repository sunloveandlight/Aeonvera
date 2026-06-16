"use client";

export type AeonOrbEnergy = "idle" | "showcase" | "summoned" | "listening" | "speaking";

type AeonOrbVisualProps = {
  className?: string;
  energy?: AeonOrbEnergy;
};

export default function AeonOrbVisual({ className = "", energy = "idle" }: AeonOrbVisualProps) {
  return (
    <span
      className={`aeon-siri-container aeon-siri-${energy} ${className}`}
      aria-hidden="true"
    >
      <svg
        className="aeon-siri-field"
        viewBox="0 0 240 160"
        preserveAspectRatio="xMidYMid meet"
        focusable="false"
      >
        <defs>
          <linearGradient id="aeonSiriSpectrum" x1="12%" x2="88%" y1="34%" y2="66%">
            <stop offset="0%" stopColor="rgba(255, 219, 142, 0.96)" />
            <stop offset="25%" stopColor="rgba(255, 64, 151, 0.92)" />
            <stop offset="52%" stopColor="rgba(128, 88, 255, 0.9)" />
            <stop offset="75%" stopColor="rgba(51, 167, 255, 0.9)" />
            <stop offset="100%" stopColor="rgba(52, 255, 169, 0.82)" />
          </linearGradient>
          <linearGradient id="aeonSiriSun" x1="45%" x2="64%" y1="35%" y2="68%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 1)" />
            <stop offset="45%" stopColor="rgba(255, 225, 150, 0.86)" />
            <stop offset="100%" stopColor="rgba(255, 155, 83, 0)" />
          </linearGradient>
          <filter id="aeonSiriGlow" x="-80%" y="-120%" width="260%" height="340%">
            <feGaussianBlur stdDeviation="9" result="blur" />
            <feColorMatrix
              in="blur"
              result="glow"
              type="matrix"
              values="1.15 0 0 0 0  0 1.05 0 0 0  0 0 1.24 0 0  0 0 0 0.82 0"
            />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g className="aeon-siri-rays">
          <path d="M118 78 L198 42" />
          <path d="M118 82 L207 82" />
          <path d="M118 86 L196 122" />
        </g>
        <g className="aeon-siri-light-core">
          <ellipse cx="120" cy="80" rx="22" ry="15" />
          <ellipse cx="128" cy="74" rx="34" ry="22" />
        </g>
        <g className="aeon-siri-waves" filter="url(#aeonSiriGlow)">
          <path
            className="aeon-siri-wave aeon-siri-wave-one"
            pathLength="1"
            d="M18 80 C48 22 88 22 120 80 C152 138 192 138 222 80 C192 22 152 22 120 80 C88 138 48 138 18 80"
          />
          <path
            className="aeon-siri-wave aeon-siri-wave-two"
            pathLength="1"
            d="M24 82 C54 36 90 34 120 80 C150 126 186 124 216 78 C188 28 151 30 120 80 C89 130 52 128 24 82"
          />
          <path
            className="aeon-siri-wave aeon-siri-wave-three"
            pathLength="1"
            d="M30 78 C58 48 92 44 120 80 C148 116 182 112 210 82 C180 42 150 44 120 80 C90 116 60 112 30 78"
          />
          <path
            className="aeon-siri-wave aeon-siri-wave-four"
            pathLength="1"
            d="M38 80 C66 58 94 56 120 80 C146 104 174 102 202 80 C174 58 146 56 120 80 C94 104 66 102 38 80"
          />
        </g>
      </svg>
    </span>
  );
}
