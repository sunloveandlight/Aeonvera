import { ArrowRight, Sparkles } from "lucide-react";

export type TodaySignal = {
  detail: string;
  label: string;
  value: string;
};

export type TodayPrimaryAction = {
  body: string;
  href: string;
  label: string;
  title: string;
};

export default function TodayBriefing({
  action,
  firstInsight,
  greeting,
  name,
  onAction,
  signals,
}: {
  action: TodayPrimaryAction;
  firstInsight: string | null;
  greeting: string;
  name: string;
  onAction: () => void;
  signals: TodaySignal[];
}) {
  return (
    <section className="executive-panel rounded-lg p-6 md:p-8">
      <div className="grid gap-8 lg:grid-cols-[1fr_0.72fr] lg:items-stretch">
        <div className="flex min-h-[19rem] flex-col justify-between">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5">
              <Sparkles size={14} className="royal-text" />
              <span className="av-eyebrow text-white/38">
                Today
              </span>
            </div>
            <h2 className="max-w-3xl text-4xl font-light leading-tight text-white md:text-5xl">
              {greeting}, {name}. Here is what matters now.
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/48">
              {firstInsight ||
                "Aeonvera is ready to build your daily health operating picture as soon as you add your first signal."}
            </p>
          </div>

          <button
            type="button"
            onClick={onAction}
            className="premium-action mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md px-5 text-sm font-medium sm:w-fit"
          >
            {action.label}
            <ArrowRight size={16} />
          </button>
        </div>

        <div className="grid gap-3">
          <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-5">
            <p className="micro-label">Next best move</p>
            <p className="mt-4 text-2xl font-light leading-tight text-white/86">
              {action.title}
            </p>
            <p className="mt-3 text-sm leading-7 text-white/42">{action.body}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {signals.map((signal) => (
              <div
                key={signal.label}
                className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4"
              >
                <p className="av-eyebrow text-white/26">
                  {signal.label}
                </p>
                <p className="mt-2 text-2xl font-light text-white/82">{signal.value}</p>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/36">
                  {signal.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
