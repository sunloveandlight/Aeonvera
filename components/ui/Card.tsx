"use client";

import { ReactNode } from "react";
import { HoverLift } from "@/components/motion/Motion";

type CardProps = {
  children: ReactNode;
  className?: string;
  title?: string;
  label?: string;
};

export default function Card({
  children,
  className = "",
  title,
  label,
}: CardProps) {
  return (
    <HoverLift>
      <div
        data-aeonvera-card
        data-aeonvera-label="CARD"
        className={`
          group
          relative
          overflow-hidden

          rounded-[28px]

          border
          border-white/10

          bg-white/[0.035]
          backdrop-blur-2xl

          p-8

          transition-all
          duration-300

          hover:border-white/15
          hover:bg-white/[0.045]
          hover:shadow-[0_18px_60px_rgba(0,0,0,0.35)]

          ${className}
        `}
      >
        {/* Top highlight */}

        <div
          className="
            absolute
            inset-x-0
            top-0
            h-px
            bg-white/20
          "
        />

        {/* Ambient glow */}

        <div
          className="
            pointer-events-none
            absolute
            inset-0
            opacity-0
            transition-opacity
            duration-500

            group-hover:opacity-100

            bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),transparent_70%)]
          "
        />

        {label && (
          <p
            className="
              mb-5

              text-[11px]
              uppercase
              tracking-[0.38em]

              text-white/40
            "
          >
            {label}
          </p>
        )}

        {title && (
          <h3
            className="
              mb-5

              text-2xl
              font-semibold
              tracking-tight

              text-white
            "
          >
            {title}
          </h3>
        )}

        <div
          className="
            relative
            z-10

            text-white/72
            leading-7
          "
        >
          {children}
        </div>
      </div>
    </HoverLift>
  );
}