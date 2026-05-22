import { PageHeader } from "@/app/dashboard/_components/shared/PageHeader";
import { DocsNav } from "./_components/DocsNav";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Developers"
        head="Docs"
        accent="install"
        description="Everything a developer needs to wire the authenticated customer widget into their own app — from token mint to sign-out."
      />
      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-8 self-start">
          <DocsNav />
        </aside>
        <article className="min-w-0">{children}</article>
      </div>
    </div>
  );
}
