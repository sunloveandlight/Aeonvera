"use client";

import { useEffect, useRef } from "react";

export type AeonOrbEnergy = "idle" | "showcase" | "summoned" | "listening" | "speaking";

type AeonOrbVisualProps = {
  className?: string;
  energy?: AeonOrbEnergy;
  intensity?: number;
};

const SIZE = 400;
const CENTER = SIZE / 2;
const TAU = Math.PI * 2;

type Node = {
  angle: number;
  orbit: number;
  radius: number;
  speed: number;
  z: number;
};

function createNodes() {
  const nodes: Node[] = [];

  for (let index = 0; index < 32; index += 1) {
    const band = index % 4;
    nodes.push({
      angle: (index / 32) * TAU + band * 0.37,
      orbit: band,
      radius: 42 + (index % 8) * 7,
      speed: 0.18 + band * 0.045 + (index % 5) * 0.012,
      z: Math.sin(index * 1.7),
    });
  }

  return nodes;
}

function projectNode(node: Node, time: number, lift: number) {
  const orbitTilt = [-0.62, -0.22, 0.18, 0.58][node.orbit] || 0;
  const angle = node.angle + time * node.speed;
  const breathing = Math.sin(time * 0.9 + node.angle) * 4.5;
  const radius = node.radius + breathing + lift * 18;
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius * (0.55 + Math.abs(orbitTilt) * 0.24);
  const tiltY = y * Math.cos(orbitTilt) - node.z * 16 * Math.sin(orbitTilt);
  const depth = Math.sin(angle + orbitTilt) * 0.5 + 0.5;

  return {
    x: CENTER + x,
    y: CENTER + tiltY,
    depth,
    size: 1.05 + depth * 1.5 + lift * 0.9,
  };
}

export default function AeonOrbVisual({
  className = "",
  energy = "idle",
  intensity = 0,
}: AeonOrbVisualProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intensityRef = useRef(0);

  useEffect(() => {
    intensityRef.current = Math.max(0, Math.min(1, intensity));
  }, [intensity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const initialContext = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !initialContext) return undefined;
    const context = initialContext;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nodes = createNodes();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    let frame = 0;
    let animationFrame = 0;

    canvas.width = SIZE * pixelRatio;
    canvas.height = SIZE * pixelRatio;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, SIZE, SIZE);

    function drawOrbShell(time: number, lift: number) {
      const voice = intensityRef.current;
      const active = energy === "listening" || energy === "speaking";
      const shellRadius = 112 + lift * 16 + voice * 18;
      const corePulse = 1 + Math.sin(time * 2.4) * 0.035 + voice * 0.16;

      context.save();
      context.globalCompositeOperation = "screen";

      const atmosphere = context.createRadialGradient(
        CENTER,
        CENTER,
        8,
        CENTER,
        CENTER,
        180 + lift * 24
      );
      atmosphere.addColorStop(0, `rgba(255, 252, 225, ${0.28 + lift * 0.16})`);
      atmosphere.addColorStop(0.22, `rgba(222, 244, 232, ${0.18 + voice * 0.12})`);
      atmosphere.addColorStop(0.46, `rgba(99, 226, 206, ${0.12 + lift * 0.08})`);
      atmosphere.addColorStop(0.7, `rgba(140, 104, 255, ${0.08 + lift * 0.05})`);
      atmosphere.addColorStop(1, "rgba(255, 255, 255, 0)");
      context.fillStyle = atmosphere;
      context.beginPath();
      context.arc(CENTER, CENTER, 180 + lift * 24, 0, TAU);
      context.fill();

      const body = context.createRadialGradient(
        CENTER - 28,
        CENTER - 34,
        8,
        CENTER,
        CENTER,
        shellRadius
      );
      body.addColorStop(0, "rgba(255, 255, 255, 0.96)");
      body.addColorStop(0.16, `rgba(255, 238, 190, ${0.55 + voice * 0.15})`);
      body.addColorStop(0.34, `rgba(160, 244, 222, ${0.19 + lift * 0.1})`);
      body.addColorStop(0.58, "rgba(154, 116, 255, 0.1)");
      body.addColorStop(0.78, "rgba(255, 255, 255, 0.035)");
      body.addColorStop(1, "rgba(255, 255, 255, 0)");
      context.fillStyle = body;
      context.beginPath();
      context.arc(CENTER, CENTER, shellRadius, 0, TAU);
      context.fill();

      const rim = context.createLinearGradient(CENTER - shellRadius, CENTER - shellRadius, CENTER + shellRadius, CENTER + shellRadius);
      rim.addColorStop(0, "rgba(255, 255, 255, 0.18)");
      rim.addColorStop(0.18, "rgba(255, 252, 224, 0.92)");
      rim.addColorStop(0.5, "rgba(142, 232, 217, 0.34)");
      rim.addColorStop(0.72, "rgba(255, 255, 255, 0.84)");
      rim.addColorStop(1, "rgba(255, 255, 255, 0.16)");
      context.strokeStyle = rim;
      context.lineWidth = 2.2 + lift * 1.1;
      context.shadowBlur = 18 + voice * 16;
      context.shadowColor = "rgba(255, 244, 204, 0.62)";
      context.beginPath();
      context.arc(CENTER, CENTER, shellRadius - 1, 0, TAU);
      context.stroke();

      context.shadowBlur = 0;
      context.globalAlpha = 0.42 + lift * 0.24;
      context.strokeStyle = "rgba(255, 255, 255, 0.74)";
      context.lineWidth = 1.05;
      context.beginPath();
      context.ellipse(CENTER, CENTER + 1, shellRadius * 1.08, shellRadius * 0.16, Math.sin(time * 0.25) * 0.08, 0, TAU);
      context.stroke();

      context.globalAlpha = 0.2 + lift * 0.16;
      context.strokeStyle = "rgba(100, 230, 212, 0.58)";
      context.beginPath();
      context.ellipse(CENTER, CENTER, shellRadius * 0.68, shellRadius * 0.92, Math.cos(time * 0.18) * 0.35, 0, TAU);
      context.stroke();

      context.globalAlpha = 1;
      const core = context.createRadialGradient(CENTER, CENTER, 0, CENTER, CENTER, 48 * corePulse);
      core.addColorStop(0, "rgba(255, 255, 255, 1)");
      core.addColorStop(0.22, "rgba(255, 248, 211, 0.98)");
      core.addColorStop(0.48, "rgba(255, 221, 154, 0.55)");
      core.addColorStop(0.72, "rgba(108, 229, 211, 0.2)");
      core.addColorStop(1, "rgba(255, 255, 255, 0)");
      context.fillStyle = core;
      context.shadowBlur = 26 + voice * 30;
      context.shadowColor = active ? "rgba(103, 237, 218, 0.78)" : "rgba(255, 237, 188, 0.68)";
      context.beginPath();
      context.arc(CENTER, CENTER, 48 * corePulse, 0, TAU);
      context.fill();

      context.restore();
    }

    function drawNeuralField(time: number, lift: number) {
      const projected = nodes.map((node) => projectNode(node, time, lift));
      const shellRadius = 104 + lift * 18;

      context.save();
      context.beginPath();
      context.arc(CENTER, CENTER, shellRadius, 0, TAU);
      context.clip();
      context.globalCompositeOperation = "screen";

      for (let index = 0; index < projected.length; index += 1) {
        const start = projected[index];
        const next = projected[(index + 5) % projected.length];
        const neighbor = projected[(index + 11) % projected.length];
        const alpha = 0.05 + start.depth * 0.14 + lift * 0.06;

        context.strokeStyle = `rgba(190, 255, 239, ${alpha})`;
        context.lineWidth = 0.55 + start.depth * 0.7;
        context.beginPath();
        context.moveTo(start.x, start.y);
        context.quadraticCurveTo(CENTER, CENTER, next.x, next.y);
        context.stroke();

        if (index % 3 === 0) {
          context.strokeStyle = `rgba(255, 241, 204, ${alpha * 0.75})`;
          context.beginPath();
          context.moveTo(start.x, start.y);
          context.lineTo(neighbor.x, neighbor.y);
          context.stroke();
        }
      }

      for (const point of projected) {
        const sparkle = 0.62 + Math.sin(time * 2.2 + point.x * 0.03) * 0.32;
        context.fillStyle = `rgba(255, 255, 246, ${0.36 + point.depth * 0.46})`;
        context.shadowBlur = 8 + point.depth * 12;
        context.shadowColor = "rgba(156, 255, 231, 0.68)";
        context.beginPath();
        context.arc(point.x, point.y, point.size * sparkle, 0, TAU);
        context.fill();
      }

      context.restore();
    }

    function drawSignalRing(time: number, lift: number) {
      const voice = intensityRef.current;
      const ringRadius = 118 + lift * 18 + voice * 16;

      context.save();
      context.globalCompositeOperation = "screen";
      context.translate(CENTER, CENTER);
      context.rotate(Math.sin(time * 0.32) * 0.06);

      for (let layer = 0; layer < 4; layer += 1) {
        const alpha = 0.12 + layer * 0.05 + lift * 0.07;
        context.strokeStyle =
          layer % 2 === 0
            ? `rgba(255, 255, 246, ${alpha})`
            : `rgba(95, 238, 214, ${alpha * 0.75})`;
        context.lineWidth = 0.7 + layer * 0.42;
        context.setLineDash([2 + layer * 2, 12 + layer * 4]);
        context.lineDashOffset = -time * (18 + layer * 9);
        context.beginPath();
        context.ellipse(0, 0, ringRadius + layer * 7, 15 + layer * 2.5, 0, 0, TAU);
        context.stroke();
      }

      context.setLineDash([]);
      const flare = context.createLinearGradient(-ringRadius * 1.25, 0, ringRadius * 1.25, 0);
      flare.addColorStop(0, "rgba(255, 255, 255, 0)");
      flare.addColorStop(0.32, "rgba(255, 255, 255, 0.18)");
      flare.addColorStop(0.5, `rgba(255, 250, 218, ${0.64 + lift * 0.24})`);
      flare.addColorStop(0.68, "rgba(129, 244, 224, 0.22)");
      flare.addColorStop(1, "rgba(255, 255, 255, 0)");
      context.strokeStyle = flare;
      context.lineWidth = 1.2 + lift * 1.2;
      context.shadowBlur = 16 + voice * 20;
      context.shadowColor = "rgba(255, 250, 218, 0.76)";
      context.beginPath();
      context.ellipse(0, 0, ringRadius * 1.18, 8 + lift * 3, 0, 0, TAU);
      context.stroke();

      context.restore();
    }

    function draw() {
      context.clearRect(0, 0, SIZE, SIZE);

      const voice = intensityRef.current;
      const active = energy === "listening" || energy === "speaking";
      const summoned = energy === "summoned" || energy === "showcase";
      const lift = (active ? 0.38 : summoned ? 0.24 : 0.08) + voice * 0.62;
      const time = frame / (reduceMotion ? 44 : 58);

      drawOrbShell(time, lift);
      drawNeuralField(time, lift);
      drawSignalRing(time, lift);

      if (energy === "speaking") {
        context.save();
        context.globalCompositeOperation = "screen";
        context.strokeStyle = `rgba(255, 246, 210, ${0.18 + voice * 0.32})`;
        context.lineWidth = 1.1 + voice * 1.5;
        context.beginPath();
        context.arc(CENTER, CENTER, 136 + Math.sin(time * 3.2) * 8 + voice * 24, 0, TAU);
        context.stroke();
        context.restore();
      }

      frame += 1;
      if (!reduceMotion) {
        animationFrame = requestAnimationFrame(draw);
      }
    }

    draw();

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [energy]);

  return (
    <span
      className={`aeon-wave-orb aeon-wave-orb-${energy} aeon-canvas-orb ${className}`}
      data-energy={energy}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="aeon-canvas-orb-surface" width={SIZE} height={SIZE} />
    </span>
  );
}
