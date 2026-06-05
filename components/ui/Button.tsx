import Link from "next/link";

type ButtonProps = {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
};

export default function Button({
  href,
  children,
  variant = "primary",
  className = "",
}: ButtonProps) {
  const styles =
    variant === "primary"
      ? "bg-white text-black hover:bg-zinc-200"
      : "bg-white/5 text-white border border-white/10 hover:bg-white/10";

  return (
    <Link
      href={href}
      className={`
        inline-flex
        items-center
        justify-center
        h-12
        px-6
        rounded-xl
        text-sm
        font-medium
        transition-all
        duration-200
        ${styles}
        ${className}
      `}
    >
      {children}
    </Link>
  );
}