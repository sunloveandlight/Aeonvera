"use client";

import { useEffect, useRef } from "react";

export type AeonOrbEnergy = "idle" | "showcase" | "summoned" | "listening" | "speaking";

type AeonOrbVisualProps = {
  className?: string;
  energy?: AeonOrbEnergy;
};

const MAX = 50;
const SIZE = 400;
const CENTER = SIZE / 2;
const HUES = [47, 178, 258, 286, 218];

function createOrbPoints() {
  const points: Array<[number, number, number]> = [];
  let r = 0;

  for (let a = 0; a < MAX; a += 1) {
    points.push([Math.cos(r), Math.sin(r), 0]);
    r += (Math.PI * 2) / MAX;
  }

  for (let a = 0; a < MAX; a += 1) {
    points.push([0, points[a][0], points[a][1]]);
  }

  for (let a = 0; a < MAX; a += 1) {
    points.push([points[a][1], 0, points[a][0]]);
  }

  return points;
}

export default function AeonOrbVisual({ className = "", energy = "idle" }: AeonOrbVisualProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const initialContext = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !initialContext) return undefined;
    const context = initialContext;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const points = createOrbPoints();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    let frame = 0;
    let animationFrame = 0;

    canvas.width = SIZE * pixelRatio;
    canvas.height = SIZE * pixelRatio;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, SIZE, SIZE);

    function draw() {
      context.globalCompositeOperation = "destination-out";
      context.fillStyle = "rgba(0, 0, 0, 0.055)";
      context.fillRect(0, 0, SIZE, SIZE);
      context.globalCompositeOperation = "lighter";

      let time = frame / (energy === "idle" ? 6.2 : 4.8);

      for (let e = 0; e < 3; e += 1) {
        time *= 1.7;
        let scale = 1 - e / 3;
        let angle = time / 59;
        const yPrimary = Math.cos(angle);
        const ySecondary = Math.sin(angle);
        angle = time / 23;
        const xPrimary = Math.cos(angle);
        const xSecondary = Math.sin(angle);
        const projected: Array<[number, number, number]> = [];

        for (let point = 0; point < points.length; point += 1) {
          const [sourceX, sourceY, sourceZ] = points[point];
          const y1 = sourceY * yPrimary + sourceZ * ySecondary;
          const z1 = sourceY * ySecondary - sourceZ * yPrimary;
          const x1 = sourceX * xPrimary + z1 * xSecondary;
          const z = sourceX * xSecondary - z1 * xPrimary;
          const depth = Math.pow(2, z * scale);

          projected.push([x1 * depth, y1 * depth, z]);
        }

        scale *= energy === "showcase" ? 126 : 118;

        for (let d = 0; d < 3; d += 1) {
          for (let a = 0; a < MAX; a += 1) {
            const start = projected[d * MAX + a];
            const end = projected[((a + 1) % MAX) + d * MAX];
            const hue = HUES[(a + d * 9 + e * 5) % HUES.length];
            const alpha = 0.11 + e * 0.025;
            const lightness = hue === 47 ? 70 : 62;

            context.beginPath();
            context.strokeStyle = `hsla(${hue}, 86%, ${lightness}%, ${alpha})`;
            context.lineWidth = Math.max(0.4, Math.pow(6, start[2]) * (energy === "idle" ? 0.82 : 1));
            context.moveTo(start[0] * scale + CENTER, start[1] * scale + CENTER);
            context.lineTo(end[0] * scale + CENTER, end[1] * scale + CENTER);
            context.stroke();
          }
        }
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
