"use client";

import { useEffect, useRef } from "react";
import type SiriWave from "siriwave";

export type AeonOrbEnergy = "idle" | "showcase" | "summoned" | "listening" | "speaking";

type AeonOrbVisualProps = {
  className?: string;
  energy?: AeonOrbEnergy;
};

const ENERGY_SPEED: Record<AeonOrbEnergy, number> = {
  idle: 0.2,
  showcase: 0.2,
  summoned: 0.2,
  listening: 0.2,
  speaking: 0.2,
};

const ENERGY_AMPLITUDE: Record<AeonOrbEnergy, number> = {
  idle: 1,
  showcase: 1,
  summoned: 1,
  listening: 1,
  speaking: 1,
};

export default function AeonOrbVisual({ className = "", energy = "idle" }: AeonOrbVisualProps) {
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const waveRef = useRef<SiriWave | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let resizeFrame = 0;

    async function createWave() {
      const target = containerRef.current;
      if (!target || cancelled) return;

      const rect = target.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;

      const { default: SiriWaveConstructor } = await import("siriwave");
      if (cancelled || !containerRef.current) return;

      waveRef.current?.dispose();
      waveRef.current = new SiriWaveConstructor({
        container: target,
        style: "ios",
        amplitude: ENERGY_AMPLITUDE[energy],
        speed: ENERGY_SPEED[energy],
        frequency: 6,
        color: "#fff",
        width: rect.width,
        height: rect.height,
        autostart: true,
      });
    }

    const observer = new ResizeObserver(() => {
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        void createWave();
      });
    });

    observer.observe(container);
    void createWave();

    return () => {
      cancelled = true;
      observer.disconnect();
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
      waveRef.current?.dispose();
      waveRef.current = null;
    };
  }, [energy]);

  useEffect(() => {
    waveRef.current?.setSpeed(ENERGY_SPEED[energy]);
    waveRef.current?.setAmplitude(ENERGY_AMPLITUDE[energy]);
  }, [energy]);

  return (
    <span
      ref={containerRef}
      className={`aeon-orb-canvas-wrap aeon-orb-siriwave aeon-orb-canvas-${energy} ${className}`}
      aria-hidden="true"
    />
  );
}
