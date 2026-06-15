import Link from "next/link";
import { ArrowRight, LockKeyhole, Sparkles } from "lucide-react";

type Action = {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
};

export default function AccessState({
  actions,
  eyebrow,
  title,
  body,
  points = [],
}: {
  actions: Action[];
  eyebrow: string;
  title: string;
  body: string;
  points?: string[];
}) {
  return (
    <div className="executive-panel rounded-lg p-6 md:p-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <div className="inline-flex size-11 items-center justify-center rounded-full border border-[rgba(var(--gold),0.25)] bg-[rgba(var(--gold),0.1)] text-[rgb(var(--gold))]">
            <LockKeyhole size={18} />
          </div>
          <p className="micro-label mt-5">{eyebrow}</p>
          <h1 className="mt-4 text-3xl font-light leading-tight text-white md:text-4xl">
            {title}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-white/52">{body}</p>
        </div>

        {points.length ? (
          <div className="w-full rounded-lg border border-white/[0.07] bg-black/20 p-4 md:w-80">
            <p className="text-[8px] uppercase tracking-[0.14em] text-[rgba(var(--gold),0.75)]">
              What unlocks
            </p>
            <div className="mt-4 space-y-3">
              {points.map((point) => (
                <div key={point} className="flex gap-3 text-sm leading-6 text-white/62">
                  <Sparkles className="mt-1 shrink-0 text-[rgba(var(--gold),0.7)]" size={13} />
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-7 flex flex-wrap gap-3">
        {actions.map((action) => (
          <Link
            key={`${action.href}-${action.label}`}
            href={action.href}
            className={
              action.variant === "secondary"
                ? "premium-action-secondary inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium"
                : "premium-action inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium"
            }
          >
            {action.label}
            <ArrowRight size={15} />
          </Link>
        ))}
      </div>
    </div>
  );
}

export function EmptyState({
  action,
  body,
  eyebrow = "Awaiting signal",
  title,
}: {
  action?: Action;
  body: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-5">
      <p className="micro-label">{eyebrow}</p>
      <h3 className="mt-3 text-xl font-light text-white">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-white/45">{body}</p>
      {action ? (
        <Link
          href={action.href}
          className="mt-5 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[rgba(var(--gold),0.8)] transition hover:text-[rgb(var(--gold))]"
        >
          {action.label}
          <ArrowRight size={13} />
        </Link>
      ) : null}
    </div>
  );
}
