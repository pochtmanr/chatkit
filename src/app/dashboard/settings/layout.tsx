import { requireActiveContext } from "@/lib/active-context";
import { SettingsNav } from "@/app/dashboard/_components/settings-nav/SettingsNav";
import { PageHeader } from "@/app/dashboard/_components/shared/PageHeader";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireActiveContext();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        head="Workspace"
        accent="settings"
        description={`Manage ${ctx.business.name} — profile, billing, team, integrations, and account.`}
      />
      <div className="grid grid-cols-1 lg:grid-cols-[12rem_1fr] gap-6 lg:gap-10">
        <aside className="lg:sticky lg:top-6 self-start">
          <SettingsNav />
        </aside>
        <section>{children}</section>
      </div>
    </div>
  );
}
