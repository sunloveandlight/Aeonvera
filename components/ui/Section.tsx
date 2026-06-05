type SectionProps = {
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  id?: string;
};

const sizes = {
  sm: "py-16",
  md: "py-24",
  lg: "py-32",
  xl: "py-40",
};

export default function Section({
  children,
  className = "",
  size = "lg",
  id,
}: SectionProps) {
  return (
    <section
      id={id}
      className={`
        w-full
        ${sizes[size]}
        border-white/10
        ${className}
      `}
    >
      {children}
    </section>
  );
}