"use client";

import { type CSSProperties, useEffect, useId, useRef } from "react";

export type AeonOrbEnergy = "idle" | "showcase" | "summoned" | "listening" | "speaking";

type AeonOrbVisualProps = {
  className?: string;
  energy?: AeonOrbEnergy;
};

export default function AeonOrbVisual({ className = "", energy = "idle" }: AeonOrbVisualProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const spectrumId = useId().replace(/:/g, "");
  const sunId = useId().replace(/:/g, "");
  const glowId = useId().replace(/:/g, "");
  const spectrumUrl = `url(#${spectrumId})`;
  const sunUrl = `url(#${sunId})`;
  const glowUrl = `url(#${glowId})`;

  useEffect(() => {
    const element = rootRef.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const orbElement = element;

    let frame = 0;
    let pointerX = window.innerWidth / 2;
    let pointerY = window.innerHeight / 2;
    const current = { x: 0, y: 0, attention: 0, tilt: 0, pulse: 0 };
    const energyBoost = energy === "listening" || energy === "speaking" ? 0.34 : energy === "summoned" ? 0.22 : 0;

    function handlePointerMove(event: PointerEvent) {
      pointerX = event.clientX;
      pointerY = event.clientY;
    }

    function animate(now: number) {
      const rect = orbElement.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = pointerX - centerX;
      const dy = pointerY - centerY;
      const distance = Math.hypot(dx, dy);
      const radius = Math.max(280, Math.min(760, Math.max(rect.width, rect.height) * 1.35));
      const attentionTarget = Math.max(0, 1 - distance / radius);
      const xTarget = Math.max(-1, Math.min(1, dx / radius));
      const yTarget = Math.max(-1, Math.min(1, dy / radius));
      const time = now / 1000;

      current.x += (xTarget - current.x) * 0.08;
      current.y += (yTarget - current.y) * 0.08;
      current.attention += (attentionTarget - current.attention) * 0.065;
      current.tilt += ((Math.atan2(dy, dx) * 180) / Math.PI - current.tilt) * 0.045;
      current.pulse =
        0.5 +
        Math.sin(time * 1.37) * 0.2 +
        Math.sin(time * 2.11 + rect.left * 0.01) * 0.13 +
        Math.sin(time * 0.73 + rect.top * 0.01) * 0.1;

      const intelligence = Math.max(0, Math.min(1, current.attention + energyBoost));
      const autonomousX = Math.sin(time * 0.83 + rect.left * 0.005) * 6;
      const autonomousY = Math.cos(time * 0.71 + rect.top * 0.006) * 5;
      const lookX = current.x * 22 + autonomousX;
      const lookY = current.y * 14 + autonomousY;

      orbElement.style.setProperty("--aeon-look-x", `${lookX.toFixed(2)}px`);
      orbElement.style.setProperty("--aeon-look-y", `${lookY.toFixed(2)}px`);
      orbElement.style.setProperty("--aeon-look-x-soft", `${(lookX * 0.46).toFixed(2)}px`);
      orbElement.style.setProperty("--aeon-look-y-soft", `${(lookY * 0.46).toFixed(2)}px`);
      orbElement.style.setProperty("--aeon-look-x-subtle", `${(lookX * 0.22).toFixed(2)}px`);
      orbElement.style.setProperty("--aeon-look-y-subtle", `${(lookY * 0.22).toFixed(2)}px`);
      orbElement.style.setProperty("--aeon-look-x-inverse", `${(lookX * -0.18).toFixed(2)}px`);
      orbElement.style.setProperty("--aeon-look-y-inverse", `${(lookY * -0.18).toFixed(2)}px`);
      orbElement.style.setProperty("--aeon-attention", intelligence.toFixed(3));
      orbElement.style.setProperty("--aeon-attention-low", (intelligence * 0.12).toFixed(3));
      orbElement.style.setProperty("--aeon-attention-mid", (intelligence * 0.24).toFixed(3));
      orbElement.style.setProperty("--aeon-attention-high", (intelligence * 0.42).toFixed(3));
      orbElement.style.setProperty("--aeon-pulse", current.pulse.toFixed(3));
      orbElement.style.setProperty("--aeon-pulse-low", (current.pulse * 0.08).toFixed(3));
      orbElement.style.setProperty("--aeon-tilt", `${current.tilt.toFixed(2)}deg`);
      orbElement.style.setProperty("--aeon-counter-tilt", `${(-current.tilt * 0.45).toFixed(2)}deg`);
      orbElement.style.setProperty("--aeon-tilt-low", `${(current.tilt * 0.04).toFixed(2)}deg`);
      orbElement.style.setProperty("--aeon-tilt-mid", `${(current.tilt * 0.07).toFixed(2)}deg`);
      orbElement.style.setProperty("--aeon-counter-tilt-low", `${(-current.tilt * 0.035).toFixed(2)}deg`);
      orbElement.style.setProperty("--aeon-depth", `${(1 + intelligence * 0.18 + current.pulse * 0.05).toFixed(3)}`);
      orbElement.style.setProperty("--aeon-hue-shift", `${(current.x * 11 + current.y * -7).toFixed(2)}deg`);
      orbElement.style.setProperty("--aeon-saturate", (1.08 + intelligence * 0.34).toFixed(3));
      orbElement.style.setProperty("--aeon-bright", (1 + intelligence * 0.18).toFixed(3));
      orbElement.style.setProperty("--aeon-scale-wide", (1.08 + intelligence * 0.14).toFixed(3));
      orbElement.style.setProperty("--aeon-scale-tall", (1.16 + current.pulse * 0.1).toFixed(3));
      orbElement.style.setProperty("--aeon-scale-live", (1.14 + intelligence * 0.22).toFixed(3));
      frame = window.requestAnimationFrame(animate);
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    frame = window.requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.cancelAnimationFrame(frame);
    };
  }, [energy]);

  return (
    <span
      ref={rootRef}
      className={`aeon-siri-container aeon-siri-${energy} ${className}`}
      data-energy={energy}
      style={
        {
          "--aeon-look-x": "0px",
          "--aeon-look-y": "0px",
          "--aeon-look-x-soft": "0px",
          "--aeon-look-y-soft": "0px",
          "--aeon-look-x-subtle": "0px",
          "--aeon-look-y-subtle": "0px",
          "--aeon-look-x-inverse": "0px",
          "--aeon-look-y-inverse": "0px",
          "--aeon-attention": 0,
          "--aeon-attention-low": 0,
          "--aeon-attention-mid": 0,
          "--aeon-attention-high": 0,
          "--aeon-pulse": 0.5,
          "--aeon-pulse-low": 0.04,
          "--aeon-tilt": "0deg",
          "--aeon-counter-tilt": "0deg",
          "--aeon-tilt-low": "0deg",
          "--aeon-tilt-mid": "0deg",
          "--aeon-counter-tilt-low": "0deg",
          "--aeon-depth": 1,
          "--aeon-hue-shift": "0deg",
          "--aeon-saturate": 1.08,
          "--aeon-bright": 1,
          "--aeon-scale-wide": 1.08,
          "--aeon-scale-tall": 1.2,
          "--aeon-scale-live": 1.14,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      <svg
        className="aeon-siri-field"
        viewBox="0 0 240 160"
        preserveAspectRatio="xMidYMid meet"
        focusable="false"
      >
        <defs>
          <linearGradient id={spectrumId} x1="12%" x2="88%" y1="34%" y2="66%">
            <stop offset="0%" stopColor="rgba(255, 219, 142, 0.96)" />
            <stop offset="25%" stopColor="rgba(255, 64, 151, 0.92)" />
            <stop offset="52%" stopColor="rgba(128, 88, 255, 0.9)" />
            <stop offset="75%" stopColor="rgba(51, 167, 255, 0.9)" />
            <stop offset="100%" stopColor="rgba(52, 255, 169, 0.82)" />
          </linearGradient>
          <linearGradient id={sunId} x1="45%" x2="64%" y1="35%" y2="68%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 1)" />
            <stop offset="45%" stopColor="rgba(255, 225, 150, 0.86)" />
            <stop offset="100%" stopColor="rgba(255, 155, 83, 0)" />
          </linearGradient>
          <filter id={glowId} x="-80%" y="-120%" width="260%" height="340%">
            <feGaussianBlur stdDeviation="9" result="blur" />
            <feColorMatrix
              in="blur"
              result="glow"
              type="matrix"
              values="1.15 0 0 0 0  0 1.05 0 0 0  0 0 1.24 0 0  0 0 0 0.82 0"
            />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g className="aeon-siri-aurora">
          <ellipse cx="112" cy="84" rx="84" ry="42" />
          <ellipse cx="134" cy="78" rx="62" ry="38" />
        </g>
        <g className="aeon-siri-rays">
          <path d="M118 78 L198 42" />
          <path d="M118 82 L207 82" />
          <path d="M118 86 L196 122" />
        </g>
        <g className="aeon-siri-light-core">
          <ellipse cx="120" cy="80" rx="22" ry="15" fill={sunUrl} />
          <ellipse cx="128" cy="74" rx="34" ry="22" fill={sunUrl} />
        </g>
        <g className="aeon-siri-waves" filter={glowUrl}>
          <path
            className="aeon-siri-wave aeon-siri-wave-one"
            pathLength="1"
            stroke={spectrumUrl}
            d="M18 80 C48 22 88 22 120 80 C152 138 192 138 222 80 C192 22 152 22 120 80 C88 138 48 138 18 80"
          />
          <path
            className="aeon-siri-wave aeon-siri-wave-two"
            pathLength="1"
            stroke={spectrumUrl}
            d="M24 82 C54 36 90 34 120 80 C150 126 186 124 216 78 C188 28 151 30 120 80 C89 130 52 128 24 82"
          />
          <path
            className="aeon-siri-wave aeon-siri-wave-three"
            pathLength="1"
            stroke={spectrumUrl}
            d="M30 78 C58 48 92 44 120 80 C148 116 182 112 210 82 C180 42 150 44 120 80 C90 116 60 112 30 78"
          />
          <path
            className="aeon-siri-wave aeon-siri-wave-four"
            pathLength="1"
            stroke={spectrumUrl}
            d="M38 80 C66 58 94 56 120 80 C146 104 174 102 202 80 C174 58 146 56 120 80 C94 104 66 102 38 80"
          />
        </g>
        <g className="aeon-siri-neural" filter={glowUrl}>
          <path d="M52 80 C84 62 101 100 120 80 C139 60 156 98 188 80" />
          <path d="M58 80 C88 103 100 58 120 80 C140 102 152 57 182 80" />
        </g>
      </svg>
    </span>
  );
}
