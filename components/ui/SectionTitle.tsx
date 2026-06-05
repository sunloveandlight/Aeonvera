type SectionTitleProps = {
  eyebrow: string;
  title: string;
  description?: string;
};

export default function SectionTitle({
  eyebrow,
  title,
  description,
}: SectionTitleProps) {
  return (
    <div className="max-w-4xl">
      <p className="text-xs uppercase tracking-[0.4em] text-white/40 mb-6">
        {eyebrow}
      </p>

      <h2 className="text-5xl md:text-6xl font-semibold tracking-tight leading-tight">
        {title}
      </h2>

      {description && (
        <p className="mt-6 text-xl text-white/60 leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}