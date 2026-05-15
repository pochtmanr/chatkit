import type { ReactNode } from "react";

export function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 mb-16">
      <div className="flex items-baseline gap-3 mb-6">
        <span className="font-serif-italic text-4xl text-deep/30 leading-none">
          {eyebrow}
        </span>
        <h2 className="text-2xl sm:text-3xl tracking-tight text-ink font-normal">
          {title}
        </h2>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}
