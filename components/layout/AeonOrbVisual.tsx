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
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="14%" stopColor="rgba(255,236,174,0.28)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.9)" />
            <stop offset="86%" stopColor="rgba(255,236,174,0.28)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <linearGradient id="aeonWaveBlue" x1="0%" x2="100%" y1="50%" y2="50%">
            <stop offset="0%" stopColor="rgba(95,200,255,0)" />
            <stop offset="20%" stopColor="rgba(75,190,255,0.28)" />
            <stop offset="60%" stopColor="rgba(140,122,255,0.76)" />
            <stop offset="84%" stopColor="rgba(99,226,209,0.24)" />
            <stop offset="100%" stopColor="rgba(99,226,209,0)" />
          </linearGradient>
          <linearGradient id="aeonWaveGreen" x1="0%" x2="100%" y1="50%" y2="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="18%" stopColor="rgba(255,255,255,0.16)" />
            <stop offset="32%" stopColor="rgba(113,229,210,0.52)" />
            <stop offset="68%" stopColor="rgba(255,232,174,0.44)" />
            <stop offset="84%" stopColor="rgba(255,255,255,0.14)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
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
          <filter id="aeonWaveSoftGlow" x="-35%" y="-140%" width="170%" height="380%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g className="aeon-wave-lines" filter="url(#aeonWaveSoftGlow)" mask="url(#aeonWaveFadeMask)">
          <path
            className="aeon-wave-line aeon-wave-line-gold"
            d="M8 60 C34 52 48 74 73 75 C105 76 119 31 149 32 C180 33 183 90 217 91 C249 92 256 47 286 46 C315 45 327 66 352 60"
          >
            <animate
              attributeName="d"
              dur="2.25s"
              repeatCount="indefinite"
              values="
                M8 60 C34 52 48 74 73 75 C105 76 119 31 149 32 C180 33 183 90 217 91 C249 92 256 47 286 46 C315 45 327 66 352 60;
                M8 60 C35 70 52 51 78 48 C108 44 120 86 150 86 C181 86 188 34 220 33 C250 31 260 82 289 80 C317 77 329 50 352 60;
                M8 60 C36 49 51 80 82 82 C108 84 124 40 152 39 C184 38 191 86 219 87 C248 88 262 37 292 39 C319 41 331 73 352 60;
                M8 60 C34 52 48 74 73 75 C105 76 119 31 149 32 C180 33 183 90 217 91 C249 92 256 47 286 46 C315 45 327 66 352 60
              "
            />
          </path>
          <path
            className="aeon-wave-line aeon-wave-line-blue"
            d="M8 58 C38 43 58 41 88 58 C115 73 128 77 156 61 C180 47 192 44 220 61 C248 78 272 76 300 58 C320 45 337 51 352 58"
          >
            <animate
              attributeName="d"
              dur="2.7s"
              repeatCount="indefinite"
              values="
                M8 58 C38 43 58 41 88 58 C115 73 128 77 156 61 C180 47 192 44 220 61 C248 78 272 76 300 58 C320 45 337 51 352 58;
                M8 58 C36 70 59 73 88 58 C116 43 132 39 158 57 C184 76 197 78 222 61 C247 45 274 42 300 58 C323 72 338 67 352 58;
                M8 58 C38 48 62 38 91 58 C118 77 132 80 158 62 C183 44 199 41 224 58 C249 74 274 77 302 58 C324 42 339 48 352 58;
                M8 58 C38 43 58 41 88 58 C115 73 128 77 156 61 C180 47 192 44 220 61 C248 78 272 76 300 58 C320 45 337 51 352 58
              "
            />
          </path>
          <path
            className="aeon-wave-line aeon-wave-line-green"
            d="M8 64 C42 70 60 86 92 65 C122 46 145 42 175 63 C206 84 232 82 262 63 C292 44 322 54 352 64"
          >
            <animate
              attributeName="d"
              dur="3.05s"
              repeatCount="indefinite"
              values="
                M8 64 C42 70 60 86 92 65 C122 46 145 42 175 63 C206 84 232 82 262 63 C292 44 322 54 352 64;
                M8 62 C41 49 61 42 92 63 C123 84 146 82 176 62 C205 43 231 44 262 64 C292 84 323 76 352 62;
                M8 65 C40 82 63 82 94 63 C124 44 148 43 176 65 C205 87 230 84 262 62 C292 42 323 49 352 65;
                M8 64 C42 70 60 86 92 65 C122 46 145 42 175 63 C206 84 232 82 262 63 C292 44 322 54 352 64
              "
            />
          </path>
          <path
            className="aeon-wave-line aeon-wave-line-white"
            d="M8 62 C48 57 70 54 108 61 C143 67 160 77 190 61 C221 45 250 53 286 61 C315 68 335 65 352 62"
          >
            <animate
              attributeName="d"
              dur="2.4s"
              repeatCount="indefinite"
              values="
                M8 62 C48 57 70 54 108 61 C143 67 160 77 190 61 C221 45 250 53 286 61 C315 68 335 65 352 62;
                M8 62 C47 68 72 70 109 61 C142 53 161 44 190 61 C222 80 250 69 286 61 C316 54 336 57 352 62;
                M8 62 C48 52 72 50 109 61 C143 74 161 78 190 61 C222 43 251 50 286 61 C316 72 335 68 352 62;
                M8 62 C48 57 70 54 108 61 C143 67 160 77 190 61 C221 45 250 53 286 61 C315 68 335 65 352 62
              "
            />
          </path>
          <path
            className="aeon-wave-line aeon-wave-line-violet"
            d="M8 60 C42 66 68 80 98 61 C126 43 148 36 176 61 C204 86 227 84 258 62 C290 40 322 55 352 60"
          >
            <animate
              attributeName="d"
              dur="3.35s"
              repeatCount="indefinite"
              values="
                M8 60 C42 66 68 80 98 61 C126 43 148 36 176 61 C204 86 227 84 258 62 C290 40 322 55 352 60;
                M8 60 C40 48 68 40 99 61 C128 82 150 85 176 61 C202 37 228 39 258 61 C289 82 323 72 352 60;
                M8 60 C43 76 69 82 100 60 C127 39 151 38 177 62 C203 86 229 84 259 60 C290 36 323 50 352 60;
                M8 60 C42 66 68 80 98 61 C126 43 148 36 176 61 C204 86 227 84 258 62 C290 40 322 55 352 60
              "
            />
          </path>
          <path
            className="aeon-wave-line aeon-wave-line-curl"
            d="M62 60 C90 48 104 48 128 60 C150 72 166 72 180 60 C194 48 210 48 232 60 C210 72 194 72 180 60 C166 48 150 48 128 60 C104 72 90 72 62 60"
          />
          <path
            className="aeon-wave-line aeon-wave-ripple aeon-wave-ripple-primary"
            d="M8 60 C34 52 48 74 73 75 C105 76 119 31 149 32 C180 33 183 90 217 91 C249 92 256 47 286 46 C315 45 327 66 352 60"
          />
          <path
            className="aeon-wave-line aeon-wave-ripple aeon-wave-ripple-secondary"
            d="M8 58 C38 43 58 41 88 58 C115 73 128 77 156 61 C180 47 192 44 220 61 C248 78 272 76 300 58 C320 45 337 51 352 58"
          />
        </g>
      </svg>
    </span>
  );
}
