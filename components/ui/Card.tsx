type CardProps = {
  label?: string;
  title?: string;
  children: React.ReactNode;
  className?: string;
};

export default function Card({
  label,
  title,
  children,
  className = "",
}: CardProps) {
  return (
    <div
      className={`
        rounded-[32px]
        border
        border-white/10
        bg-white/[0.03]
        backdrop-blur-xl
        p-8
        ${className}
      `}
    >
      {label && (
        <p className="text-xs uppercase tracking-[0.3em] text-white/40 mb-4">
          {label}
        </p>
      )}

      {title && (
        <h3 className="text-2xl font-semibold mb-4">
          {title}
        </h3>
      )}

      <div className="text-white/60 leading-relaxed">
        {children}
      </div>
    </div>
  );
}