type SpinnerSize = "sm" | "md" | "lg";

type SpinnerProps = {
  size?: SpinnerSize;
  label?: string;
  className?: string;
};

const SIZE_CLASSES: Record<SpinnerSize, string> = {
  sm: "w-6 h-6",
  md: "w-12 h-12",
  lg: "w-16 h-16",
};

export default function Spinner({
  size = "md",
  label,
  className = "",
}: SpinnerProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-6 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className={`relative ${SIZE_CLASSES[size]}`}>
        <div className="absolute inset-0 rounded-full border border-white/[0.06]" />
        <div className="absolute inset-0 rounded-full border-t border-[rgb(var(--gold))] animate-spin" />
      </div>
      {label ? (
        <p className="av-eyebrow text-white/20">{label}</p>
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </div>
  );
}
