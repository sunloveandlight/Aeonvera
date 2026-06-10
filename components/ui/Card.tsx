"use client";

import { KeyboardEvent, ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
  title?: string;
  glow?: boolean;
  hover?: boolean;
  onClick?: () => void;
  actionLabel?: string;
};

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof HTMLElement
    ? Boolean(target.closest("button, input, label, select, textarea, a"))
    : false;
}

export default function Card({
  children,
  className = "",
  title,
  hover = true,
  onClick,
  actionLabel,
}: CardProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!onClick || isInteractiveTarget(event.target)) return;
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    onClick();
  }

  return (
    <div
      data-aeonvera-card
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={actionLabel}
      onClick={(event) => {
        if (!onClick || isInteractiveTarget(event.target)) return;
        onClick();
      }}
      onKeyDown={handleKeyDown}
      className={`
        executive-panel
        relative h-full rounded-lg

        transition-all duration-500

        ${hover ? "quiet-lift" : ""}
        ${onClick ? "cursor-pointer" : ""}

        ${className}
      `}
    >
      {/* CONTENT */}
      <div className="relative z-10 flex h-full flex-col p-6">

        {title && (
          <div className="mb-5 pb-3 border-b border-white/[0.06]">
            <p className="micro-label">
              {title}
            </p>
          </div>
        )}

        {children}

      </div>
    </div>
  );
}
