"use client";

export type AeonOrbEnergy = "idle" | "showcase" | "summoned" | "listening" | "speaking";

type AeonOrbVisualProps = {
  className?: string;
  energy?: AeonOrbEnergy;
};

const RINGS = [
  "aeon-orb-ring-gold",
  "aeon-orb-ring-teal",
  "aeon-orb-ring-violet",
  "aeon-orb-ring-white",
  "aeon-orb-ring-soft",
];

const PARTICLES = Array.from({ length: 14 }, (_, index) => index);

export default function AeonOrbVisual({ className = "", energy = "idle" }: AeonOrbVisualProps) {
  return (
    <span
      className={`aeon-wave-orb aeon-wave-orb-${energy} ${className}`}
      data-energy={energy}
      aria-hidden="true"
    >
      <span className="aeon-orb-atmosphere" />
      <span className="aeon-orb-light" />
      <span className="aeon-orb-particles">
        {PARTICLES.map((particle) => (
          <span key={particle} className="aeon-orb-particle" />
        ))}
      </span>
      <span className="aeon-orb-rings">
        {RINGS.map((ring) => (
          <span key={ring} className={`aeon-orb-ring ${ring}`} />
        ))}
      </span>
      <span className="aeon-orb-core" />
    </span>
  );
}
