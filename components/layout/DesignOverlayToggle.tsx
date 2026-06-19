"use client";

type DesignOverlayToggleProps = {
  enabled: boolean;
  onToggle: () => void;
};

export default function DesignOverlayToggle({
  enabled,
  onToggle,
}: DesignOverlayToggleProps) {
  return (
    <button
      onClick={onToggle}
      type="button"
      aria-pressed={enabled}
      title="Toggle design audit overlay. Shortcut: Command + Shift + A"
      className={`
        fixed bottom-5 left-5 z-[99999]
        px-4 py-2 rounded-md
        av-eyebrow
        border border-white/10
        backdrop-blur-xl
        transition-all duration-300
        ${
          enabled
            ? "premium-action"
            : "premium-action-secondary"
        }
      `}
    >
      {enabled ? "Audit ON" : "Design audit"}
    </button>
  );
}
