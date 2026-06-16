"use client";

import { useEffect, useRef } from "react";
import SiriWave from "siriwave";

export type AeonOrbEnergy = "idle" | "showcase" | "summoned" | "listening" | "speaking";

type AeonOrbVisualProps = {
  className?: string;
  energy?: AeonOrbEnergy;
};

export default function AeonOrbVisual({ className = "", energy = "idle" }: AeonOrbVisualProps) {
  const containerRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const siriWave = new SiriWave({
      container,
      style: "ios",
      amplitude: 1,
      speed: 0.2,
      frequency: 6,
      color: "#fff",
    });

    siriWave.start();

    return () => {
      siriWave.dispose();
    };
  }, []);

  return (
    <span
      ref={containerRef}
      className={`aeon-orb-canvas-wrap aeon-orb-siriwave aeon-orb-canvas-${energy} ${className}`}
      aria-hidden="true"
    />
  );
}
