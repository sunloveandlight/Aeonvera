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
  const core = unit * 0.7 * state.scale;
  const t = time * state.speed;

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  const sun = ctx.createRadialGradient(cx - core * 0.08, cy - core * 0.05, 0, cx, cy, core * 0.95);
  sun.addColorStop(0, `rgba(255, 250, 227, ${0.62 * state.alpha})`);
  sun.addColorStop(0.18, `rgba(255, 220, 136, ${0.28 * state.alpha})`);
  sun.addColorStop(0.44, `rgba(83, 214, 204, ${0.15 * state.alpha})`);
  sun.addColorStop(1, "rgba(255,255,255,0)");
  ctx.filter = `blur(${Math.max(7, core * 0.12 * state.blur)}px)`;
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(cx, cy, core, 0, Math.PI * 2);
  ctx.fill();

  ctx.filter = `blur(${Math.max(5, core * 0.075 * state.blur)}px)`;
  for (let i = 0; i < 14; i += 1) {
    const rayAngle = t * 0.16 + (i / 14) * Math.PI * 2 + Math.sin(t * 0.29 + i) * 0.28;
    const innerRadius = core * (0.18 + Math.sin(t * 0.41 + i) * 0.035);
    const outerRadius = core * (0.9 + Math.cos(t * 0.33 + i) * 0.12);

    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(rayAngle) * innerRadius, cy + Math.sin(rayAngle) * innerRadius);
    ctx.lineTo(cx + Math.cos(rayAngle) * outerRadius, cy + Math.sin(rayAngle) * outerRadius);
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(1, core * (0.018 + (i % 3) * 0.004));
    ctx.strokeStyle = color(i, 0.05 * state.alpha);
    ctx.shadowBlur = core * 0.12;
    ctx.shadowColor = color(i + 1, 0.18 * state.alpha);
    ctx.stroke();
  }

  ctx.filter = `blur(${Math.max(0.6, core * 0.008 * state.blur)}px)`;
  for (let loop = 0; loop < 5; loop += 1) {
    const phase = t * (0.42 + loop * 0.018) + loop * 0.77;
    const isPrimary = loop < 2;
    const rotation = isPrimary
      ? Math.sin(t * 0.17 + loop) * 0.12
      : Math.sin(t * 0.19 + loop) * 0.5 + Math.sin(t * 0.07 + loop * 2.1) * 0.34;
    const stretchX = core * (isPrimary ? 1.18 : 1.02) * (1 + Math.sin(t * 0.23 + loop) * 0.045);
    const stretchY = core * (isPrimary ? 0.36 : 0.42) * (1 + Math.cos(t * 0.31 + loop) * 0.08);
    const lift = Math.sin(t * 0.37 + loop * 1.4) * core * 0.04;

    ctx.beginPath();
    for (let step = 0; step <= 260; step += 1) {
      const p = (step / 260) * Math.PI * 2 + phase;
      const living =
        Math.sin(p * 3 + t * 0.9 + loop) * 0.045 +
        Math.sin(p * 5 - t * 0.54 + loop * 1.8) * 0.022 * state.turbulence;
      const rawX = Math.sin(p) * stretchX * (1 + living);
      const rawY = Math.sin(p) * Math.cos(p) * stretchY * (1 - living * 0.6);
      const x = cx + rawX * Math.cos(rotation) - rawY * Math.sin(rotation);
      const y = cy + rawX * Math.sin(rotation) + rawY * Math.cos(rotation) + lift;

      if (step === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1.2, core * (isPrimary ? 0.088 - loop * 0.022 : 0.018));
    ctx.strokeStyle = color(loop + 1, (isPrimary ? 0.46 - loop * 0.12 : 0.055) * state.alpha);
    ctx.shadowBlur = core * (isPrimary ? 0.24 : 0.1);
    ctx.shadowColor = color(loop + 2, (isPrimary ? 0.52 : 0.12) * state.alpha);
    ctx.stroke();
  }

  ctx.filter = `blur(${Math.max(1.2, core * 0.018)}px)`;
  const crossing = ctx.createRadialGradient(cx - core * 0.03, cy - core * 0.02, 0, cx, cy, core * 0.36);
  crossing.addColorStop(0, `rgba(255, 253, 238, ${0.56 * state.alpha})`);
  crossing.addColorStop(0.22, `rgba(255, 222, 145, ${0.26 * state.alpha})`);
  crossing.addColorStop(0.62, `rgba(81, 214, 203, ${0.12 * state.alpha})`);
  crossing.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = crossing;
  ctx.beginPath();
  ctx.arc(cx, cy, core * 0.42, 0, Math.PI * 2);
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
