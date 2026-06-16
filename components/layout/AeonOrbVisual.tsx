"use client";

export type AeonOrbEnergy = "idle" | "showcase" | "summoned" | "listening" | "speaking";

type AeonOrbVisualProps = {
  className?: string;
  energy?: AeonOrbEnergy;
};

export default function AeonOrbVisual({ className = "", energy = "idle" }: AeonOrbVisualProps) {
  return (
    <span className={`aeon-voice-orb aeon-voice-orb-${energy} ${className}`} data-energy={energy} aria-hidden="true">
      <span className="aeon-voice-aura aeon-voice-aura-one" />
      <span className="aeon-voice-aura aeon-voice-aura-two" />
      <span className="aeon-voice-body">
        <span className="aeon-voice-liquid aeon-voice-liquid-one" />
        <span className="aeon-voice-liquid aeon-voice-liquid-two" />
        <span className="aeon-voice-liquid aeon-voice-liquid-three" />
        <span className="aeon-voice-glass" />
      </span>
      <svg className="aeon-voice-waves" viewBox="0 0 240 96" focusable="false" preserveAspectRatio="xMidYMid meet">
        <path className="aeon-voice-wave aeon-voice-wave-one" d="M10 50 C32 18 52 18 74 50 S116 82 138 50 S180 18 202 50 S224 82 230 50" />
        <path className="aeon-voice-wave aeon-voice-wave-two" d="M16 50 C42 35 56 70 82 50 S122 30 148 50 S188 70 224 50" />
        <path className="aeon-voice-wave aeon-voice-wave-three" d="M22 50 C52 58 66 38 96 50 S146 62 176 50 S210 40 226 50" />
      </svg>
    </span>
  );
}
