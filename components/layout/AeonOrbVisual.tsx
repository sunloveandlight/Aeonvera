"use client";

import { useEffect, useRef } from "react";

export type AeonOrbEnergy = "idle" | "showcase" | "summoned" | "listening" | "speaking";

type AeonOrbVisualProps = {
  className?: string;
  energy?: AeonOrbEnergy;
};

const ENERGY: Record<
  AeonOrbEnergy,
  { alpha: number; blur: number; scale: number; speed: number; turbulence: number }
> = {
  idle: { alpha: 0.62, blur: 1.06, scale: 0.9, speed: 0.68, turbulence: 0.55 },
  showcase: { alpha: 0.92, blur: 0.96, scale: 1.05, speed: 0.9, turbulence: 0.74 },
  summoned: { alpha: 1.02, blur: 0.9, scale: 1, speed: 1.16, turbulence: 0.86 },
  listening: { alpha: 1.12, blur: 0.84, scale: 1.04, speed: 1.34, turbulence: 1 },
  speaking: { alpha: 1.2, blur: 0.78, scale: 1.08, speed: 1.72, turbulence: 1.2 },
};

const PALETTE = [
  [255, 229, 164],
  [224, 183, 93],
  [86, 213, 203],
  [44, 151, 255],
  [169, 125, 255],
  [255, 248, 230],
] as const;

function color(index: number, alpha: number) {
  const [r, g, b] = PALETTE[index % PALETTE.length];
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawOrb(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, energy: AeonOrbEnergy) {
  const state = ENERGY[energy];
  const cx = width / 2;
  const cy = height / 2;
  const unit = Math.min(width, height) * 0.5;
  const core = unit * 0.78 * state.scale;
  const t = time * state.speed;
  const waveWidth = Math.min(width * 0.92, core * 2.75);
  const waveHeight = Math.min(height * 0.58, core * 1.18);
  const startX = cx - waveWidth / 2;
  const centerY = cy + Math.sin(t * 0.32) * core * 0.025;

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  const sun = ctx.createRadialGradient(cx, centerY, 0, cx, centerY, core * 0.96);
  sun.addColorStop(0, `rgba(255, 252, 232, ${0.52 * state.alpha})`);
  sun.addColorStop(0.16, `rgba(255, 220, 136, ${0.26 * state.alpha})`);
  sun.addColorStop(0.42, `rgba(83, 214, 204, ${0.14 * state.alpha})`);
  sun.addColorStop(1, "rgba(255,255,255,0)");
  ctx.filter = `blur(${Math.max(7, core * 0.11 * state.blur)}px)`;
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(cx, centerY, core, 0, Math.PI * 2);
  ctx.fill();

  for (let pass = 0; pass < 2; pass += 1) {
    ctx.filter = pass === 0 ? `blur(${Math.max(2, core * 0.035 * state.blur)}px)` : "none";

    for (let wave = 0; wave < 7; wave += 1) {
      const progress = (wave + 1) / 7;
      const direction = wave % 2 === 0 ? 1 : -1;
      const phase = t * (2.25 + wave * 0.11) * direction + wave * 0.9;
      const amplitude =
        waveHeight *
        (0.1 + progress * 0.26) *
        (0.68 + Math.sin(t * 0.42 + wave) * 0.12) *
        state.turbulence;
      const frequency = 1.42 + progress * 1.08;
      const verticalDrift = Math.sin(t * (0.33 + wave * 0.03) + wave) * core * 0.045;

      ctx.beginPath();
      for (let xStep = 0; xStep <= waveWidth; xStep += 2) {
        const normalizedX = xStep / waveWidth;
        const envelope = Math.max(0, 1 - (2 * normalizedX - 1) ** 2);
        const fine =
          Math.sin(normalizedX * Math.PI * (frequency * 1.8) - phase * 0.42) *
          amplitude *
          0.14 *
          envelope;
        const sine = Math.sin(normalizedX * frequency * Math.PI * 2 + phase);
        const y =
          centerY +
          verticalDrift +
          sine * amplitude * envelope +
          fine +
          Math.sin(t * 0.8 + normalizedX * Math.PI * 2 + wave) * core * 0.01;
        const x = startX + xStep;

        if (xStep === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(1, core * (pass === 0 ? 0.032 + progress * 0.026 : 0.01 + progress * 0.011));
      ctx.strokeStyle = color(wave, (pass === 0 ? 0.16 + progress * 0.12 : 0.2 + progress * 0.18) * state.alpha);
      ctx.shadowBlur = core * (pass === 0 ? 0.22 : 0.14);
      ctx.shadowColor = color(wave + 1, (0.34 + progress * 0.16) * state.alpha);
      ctx.stroke();
    }
  }

  ctx.filter = `blur(${Math.max(1, core * 0.012)}px)`;
  const crossing = ctx.createRadialGradient(cx, centerY, 0, cx, centerY, core * 0.3);
  crossing.addColorStop(0, `rgba(255, 253, 238, ${0.66 * state.alpha})`);
  crossing.addColorStop(0.18, `rgba(255, 222, 145, ${0.32 * state.alpha})`);
  crossing.addColorStop(0.58, `rgba(81, 214, 203, ${0.12 * state.alpha})`);
  crossing.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = crossing;
  ctx.beginPath();
  ctx.arc(cx, centerY, core * 0.38, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export default function AeonOrbVisual({ className = "", energy = "idle" }: AeonOrbVisualProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const targetCanvas = canvas;
    const target = parent;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let width = 0;
    let height = 0;
    const seed = Math.random() * 1000;

    function resize() {
      const rect = target.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.round(rect.width * dpr));
      height = Math.max(1, Math.round(rect.height * dpr));
      targetCanvas.width = width;
      targetCanvas.height = height;
    }

    function animate(now: number) {
      const ctx = targetCanvas.getContext("2d");
      if (!ctx) return;

      drawOrb(ctx, width, height, now / 1000 + seed, energy);
      if (!motionQuery.matches) frame = window.requestAnimationFrame(animate);
    }

    const observer = new ResizeObserver(() => {
      resize();
      if (motionQuery.matches) {
        const ctx = targetCanvas.getContext("2d");
        if (ctx) drawOrb(ctx, width, height, seed, energy);
      }
    });

    resize();
    observer.observe(target);
    frame = window.requestAnimationFrame(animate);

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [energy]);

  return (
    <span className={`aeon-orb-canvas-wrap aeon-orb-canvas-${energy} ${className}`} aria-hidden="true">
      <canvas ref={canvasRef} className="aeon-orb-canvas" />
    </span>
  );
}
