import Link from "next/link";

type ButtonProps = {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
  disabled?: boolean;
};

export default function Button({
  href,
  children,
  variant = "primary",
  className = "",
  disabled = false,
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center h-12 px-6 rounded-xl text-sm font-medium transition-all duration-200 relative overflow-hidden";

  const variants = {
    primary:
      "bg-white text-black hover:bg-zinc-200 shadow-sm hover:shadow-md",
    secondary:
      "bg-white/5 text-white border border-white/10 hover:bg-white/10",
  };

  const disabledStyles =
    "opacity-40 pointer-events-none grayscale";

  return (
    <Link
      href={href}
      aria-disabled={disabled}
      className={`
        ${base}
        ${variants[variant]}
        ${disabled ? disabledStyles : "hover:-translate-y-0.5 active:translate-y-0"}
        focus:outline-none focus:ring-2 focus:ring-white/20
        ${className}
      `}
    >
      {/* subtle glow layer (OS-level polish) */}
      <span className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity bg-white/5" />

      <span className="relative z-10">
        {children}
      </span>
    </Link>
  );
}