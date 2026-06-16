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
  const core = unit * 0.66 * state.scale;
  const t = time * state.speed;

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  ctx.filter = `blur(${Math.max(5, core * 0.12 * state.blur)}px)`;
  for (let i = 0; i < 9; i += 1) {
    const phase = i * 1.739;
    const wobble =
      Math.sin(t * (0.34 + i * 0.015) + phase) * Math.cos(t * (0.21 + i * 0.018) + phase * 0.7);
    const orbit = core * (0.18 + (i % 3) * 0.08 + wobble * 0.055 * state.turbulence);
    const angle =
      t * (0.18 + i * 0.022) +
      phase +
      Math.sin(t * 0.27 + i) * 0.72 * state.turbulence;
    const x = cx + Math.cos(angle) * orbit + Math.sin(t * 0.49 + phase) * core * 0.12;
    const y = cy + Math.sin(angle * 0.86) * orbit + Math.cos(t * 0.42 + phase) * core * 0.1;
    const radius = core * (0.62 + (i % 4) * 0.1);
    const gradient = ctx.createRadialGradient(0, 0, radius * 0.08, 0, 0, radius);

    gradient.addColorStop(0, color(i, 0.22 * state.alpha));
    gradient.addColorStop(0.34, color(i + 1, 0.11 * state.alpha));
    gradient.addColorStop(1, "rgba(255,255,255,0)");

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle * 0.42);
    ctx.scale(1.36 + Math.sin(t * 0.31 + phase) * 0.18, 0.68 + Math.cos(t * 0.29 + phase) * 0.14);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.filter = `blur(${Math.max(1.5, core * 0.022 * state.blur)}px)`;
  for (let i = 0; i < 8; i += 1) {
    const phase = i * 1.24;
    const wave = Math.sin(t * (0.38 + i * 0.03) + phase) * state.turbulence;
    const radius = core * (0.56 + i * 0.034);
    const leftX = cx - radius * (1.18 + wave * 0.09);
    const rightX = cx + radius * (1.18 - wave * 0.06);
    const startY = cy + Math.sin(t * 0.43 + phase) * core * 0.18 + (i - 3.5) * core * 0.018;
    const endY = cy + Math.cos(t * 0.37 + phase) * core * 0.18 - (i - 3.5) * core * 0.012;
    const cp1x = cx - radius * 0.42 + Math.cos(t * 0.73 + phase) * core * 0.38;
    const cp1y = cy - radius * (0.52 + Math.sin(t * 0.22 + phase) * 0.18) + Math.sin(t * 0.57 + phase) * core * 0.2;
    const cp2x = cx + radius * 0.42 + Math.sin(t * 0.64 + phase) * core * 0.38;
    const cp2y = cy + radius * (0.52 + Math.cos(t * 0.2 + phase) * 0.16) + Math.cos(t * 0.51 + phase) * core * 0.2;

    ctx.beginPath();
    ctx.moveTo(leftX, startY);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, rightX, endY);
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(4, core * (0.105 - i * 0.006));
    ctx.strokeStyle = color(i + 1, (0.23 - i * 0.018) * state.alpha);
    ctx.shadowBlur = core * 0.2;
    ctx.shadowColor = color(i + 2, 0.44 * state.alpha);
    ctx.stroke();
  }

  ctx.filter = `blur(${Math.max(1.5, core * 0.018)}px)`;
  const inner = ctx.createRadialGradient(cx - core * 0.12, cy - core * 0.08, 0, cx, cy, core * 0.72);
  inner.addColorStop(0, `rgba(255, 253, 244, ${0.28 * state.alpha})`);
  inner.addColorStop(0.32, `rgba(255, 225, 156, ${0.13 * state.alpha})`);
  inner.addColorStop(0.58, `rgba(79, 211, 205, ${0.11 * state.alpha})`);
  inner.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.arc(cx, cy, core * 0.78, 0, Math.PI * 2);
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
