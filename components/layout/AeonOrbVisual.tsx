"use client";

export type AeonOrbEnergy = "idle" | "showcase" | "summoned" | "listening" | "speaking";

type AeonOrbVisualProps = {
  className?: string;
  energy?: AeonOrbEnergy;
};

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
        <svg className="aeon-orb-plasma-field" viewBox="-100 -100 200 200" focusable="false">
          <path className="aeon-orb-plasma-arc aeon-orb-plasma-gold" d="M -50 6 C -30 -34 28 -36 50 -6" />
          <path className="aeon-orb-plasma-arc aeon-orb-plasma-teal" d="M -44 -14 C -22 36 24 38 46 10" />
          <path className="aeon-orb-plasma-arc aeon-orb-plasma-violet" d="M -38 38 C -54 2 -16 -38 40 -38" />
          <path className="aeon-orb-plasma-arc aeon-orb-plasma-white" d="M -42 -34 C 0 -48 48 -18 42 30" />
          <path className="aeon-orb-plasma-arc aeon-orb-plasma-soft" d="M -54 18 C -18 52 40 36 56 -14" />
        </svg>
      </span>
      <span className="aeon-orb-core" />
    </span>
  );
}
