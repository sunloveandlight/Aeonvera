"use client";

import Link from "next/link";
import { ArrowRight, Sparkles, type LucideIcon } from "lucide-react";

type NextBestActionProps = {
  actionLabel: string;
  body: string;
  busy?: boolean;
  className?: string;
  eyebrow?: string;
  href?: string;
  icon?: LucideIcon;
  secondaryHref?: string;
  secondaryLabel?: string;
  secondaryOnAction?: () => void | Promise<void>;
  title: string;
  onAction?: () => void | Promise<void>;
};

export default function NextBestAction({
  actionLabel,
  body,
  busy = false,
  className = "",
  eyebrow = "Next best move",
  href,
  icon: Icon = Sparkles,
  secondaryHref,
  secondaryLabel,
  secondaryOnAction,
  title,
  onAction,
}: NextBestActionProps) {
  const primaryClasses =
    "premium-action inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-45";

  return (
    <section className={`executive-panel rounded-lg p-5 md:p-6 ${className}`}>
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5">
            <Icon size={14} className="royal-text" />
            <p className="av-eyebrow text-white/38">{eyebrow}</p>
          </div>
          <h2 className="text-2xl font-semibold leading-tight text-white/88">
            {title}
          </h2>
          <p className="av-muted mt-3 max-w-3xl text-sm leading-7">{body}</p>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          {secondaryOnAction && secondaryLabel ? (
            <button
              type="button"
              onClick={() => void secondaryOnAction()}
              className="premium-action-secondary inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-medium"
            >
              {secondaryLabel}
            </button>
          ) : secondaryHref && secondaryLabel ? (
            <Link
              href={secondaryHref}
              className="premium-action-secondary inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-medium"
            >
              {secondaryLabel}
            </Link>
          ) : null}

          {href ? (
            <Link href={href} className={primaryClasses}>
              {actionLabel}
              <ArrowRight size={15} />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => void onAction?.()}
              disabled={busy || !onAction}
              className={primaryClasses}
            >
              {busy ? "Working" : actionLabel}
              <ArrowRight size={15} />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
