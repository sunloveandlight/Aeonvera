type SectionTitleProps = {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
};

export default function SectionTitle({
  eyebrow,
  title,
  description,
  align = "left",
}: SectionTitleProps) {
  return (
    <div
      className={`
        max-w-4xl
        ${align === "center" ? "mx-auto text-center" : ""}
      `}
    >
      {/* EYEBROW (SYSTEM LABEL LAYER) */}
      <p className="text-xs uppercase tracking-[0.45em] text-white/40 mb-5">
        {eyebrow}
      </p>

      {/* TITLE (LOCKED HIERARCHY SIZE) */}
      <h2 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.1]">
        {title}
      </h2>

      {/* DESCRIPTION (SOFT CONTEXT LAYER) */}
      {description && (
        <p className="mt-5 text-lg md:text-xl text-white/60 leading-relaxed max-w-3xl">
          {description}
        </p>
      )}
    </div>
  );
}