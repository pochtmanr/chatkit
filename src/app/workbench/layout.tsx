import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requireWorkbenchContext } from "@/lib/workbench-context";
import { requireRole } from "@/lib/team";
import { WorkbenchTopBar } from "./_components/WorkbenchTopBar";
import { QueueRail } from "./_components/QueueRail";

export const dynamic = "force-dynamic";

const MANAGER_COOKIE = "workbench_manager";

export default async function WorkbenchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireWorkbenchContext();
  // Owner/lead/agent all pass the agent gate.
  const guard = await requireRole(ctx.business.id, "agent");
  if (!guard.ok) redirect("/dashboard");

  const cookieStore = await cookies();
  const managerView =
    ctx.role === "owner" && cookieStore.get(MANAGER_COOKIE)?.value === "1";

  return (
    <div className="flex flex-col h-dvh bg-mist/30 text-ink">
      <WorkbenchTopBar
        business={ctx.business}
        businesses={ctx.businesses}
        inboxes={ctx.inboxes}
        role={ctx.role}
        hasAgentRow={ctx.hasAgentRow}
        agentId={ctx.agentId}
        managerView={managerView}
        userEmail={ctx.user.email}
      />
      <div className="flex flex-1 min-h-0">
        <QueueRail
          businessId={ctx.business.id}
          userId={ctx.user.id}
          inboxes={ctx.inboxes}
          managerView={managerView}
        />
        <main className="flex-1 min-w-0 flex flex-col bg-white">
          {children}
        </main>
      </div>
    </div>
  );
}
