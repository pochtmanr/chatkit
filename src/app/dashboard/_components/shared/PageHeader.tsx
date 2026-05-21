export function PageHeader({
  eyebrow,
  head,
  accent,
  description,
}: {
  eyebrow: string;
  head: string;
  accent: string;
  description?: string;
}) {
  return (
    <header className="space-y-3">
      <p className="text-[14px] font-medium text-deep/60">{eyebrow}</p>
      <h1 className="text-3xl sm:text-4xl tracking-tight text-ink leading-[1] font-normal">
        {head}{" "}
        <span className="font-serif-italic font-normal text-deep">
          {accent}
          <span className="text-deep/40">.</span>
        </span>
      </h1>
      {description && (
        <p className="text-deep/70 leading-relaxed text-[15px] font-normal max-w-[640px]">
          {description}
        </p>
      )}
    </header>
  );
}
