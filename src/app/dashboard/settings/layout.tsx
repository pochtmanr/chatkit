import { requireActiveContext } from "@/lib/active-context";
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
      {children}
    </div>
  );
}
