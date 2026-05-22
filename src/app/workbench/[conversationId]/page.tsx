import { notFound } from "next/navigation";
import { getServiceClient } from "@/lib/supabase/server";
import { requireRole, listAgents } from "@/lib/team";
import { requireWorkbenchContext } from "@/lib/workbench-context";
import { Avatar } from "@/app/dashboard/_components/shared/Avatar";
import { StatusDropdown } from "@/app/dashboard/_components/ui/StatusDropdown";
import { type ConversationStatus } from "@/lib/conversation-status";
import { ThreadView } from "@/app/dashboard/inbox/[id]/ThreadView";
import { ClaimButton, type TransferTarget } from "../_components/ClaimButton";

const ASSIGNEE_SKILL_VISIBLE = 3;

function AssigneeChip({
  displayName,
  status,
  skills,
}: {
  displayName: string;
  status: "online" | "away" | "offline";
  skills: string[];
}) {
  const dot =
    status === "online"
      ? "bg-emerald-500"
      : status === "away"
        ? "bg-amber-400"
        : "bg-zinc-400";
  const visible = skills.slice(0, ASSIGNEE_SKILL_VISIBLE);
  const overflow = skills.length - visible.length;
  return (
    <div className="hidden md:flex items-center gap-2 rounded-full bg-mist/60 border border-mist px-3 py-1 text-[11px] text-deep/70">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-label={status} />
      <span className="font-medium text-ink">{displayName}</span>
      {visible.map((s) => (
        <span
          key={s}
          className="inline-flex items-center rounded-full bg-white text-deep px-1.5 py-0.5 text-[10px] font-medium border border-mist"
        >
          {s}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="inline-flex items-center rounded-full bg-white/70 text-deep/70 px-1.5 py-0.5 text-[10px] font-medium border border-mist"
          title={skills.slice(ASSIGNEE_SKILL_VISIBLE).join(", ")}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}

export const dynamic = "force-dynamic";

export default async function WorkbenchConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const ctx = await requireWorkbenchContext();
  const guard = await requireRole(ctx.business.id, "agent");
  if (!guard.ok) notFound();

  const service = getServiceClient();
  const { data: conv } = await service
    .from("conversations")
    .select(
      "id, tenant_id, inbox_id, external_ref, kind, status, transferred_note, assigned_to",
    )
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv || conv.tenant_id !== ctx.business.id) notFound();

  const [counterpartRes, inboxRes, siblingsRes] = await Promise.all([
    conv.external_ref
      ? service
          .from("chat_users")
          .select("user_id, name, email")
          .eq("tenant_id", conv.tenant_id)
          .eq("user_id", conv.external_ref)
          .maybeSingle()
      : Promise.resolve({ data: null } as { data: null }),
    service.from("inboxes").select("name").eq("id", conv.inbox_id).maybeSingle(),
    service
      .from("inboxes")
      .select("id, name")
      .eq("business_id", conv.tenant_id)
      .is("archived_at", null)
      .neq("id", conv.inbox_id)
      .order("name", { ascending: true }),
  ]);
  const counterpart = counterpartRes.data;
  const inboxName = inboxRes.data?.name ?? "Inbox";

  const displayName =
    counterpart?.name ||
    counterpart?.email ||
    conv.external_ref ||
    conv.id.slice(0, 8);

  const { data: rows } = await service
    .from("messages")
    .select("id, sender_id, body, message_type, media_url, created_at")
    .eq("conversation_id", conv.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  const initialMessages = (rows ?? []).reverse();

  // Transfer popover: every accepted, non-archived agent in the business
  // except the caller, sorted online → away → offline.
  const agents = await listAgents(ctx.business.id);
  const STATUS_RANK: Record<"online" | "away" | "offline", number> = {
    online: 0,
    away: 1,
    offline: 2,
  };
  const transferTargets: TransferTarget[] = agents
    .filter((a) => a.accepted_at !== null && a.user_id !== ctx.user.id)
    .sort(
      (a, b) =>
        STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
        a.display_name.localeCompare(b.display_name),
    )
    .map((a) => ({
      userId: a.user_id,
      displayName: a.display_name,
      status: a.status,
      skills: a.skills,
    }));

  // Resolve the current assignee for the inline chip in the header. Joined
  // through support_agents so an orphaned assigned_to (agent archived out
  // of the business) silently falls back to no chip.
  const assignee =
    conv.assigned_to
      ? agents.find((a) => a.user_id === conv.assigned_to) ?? null
      : null;

  const assignedToMe =
    !!conv.assigned_to && conv.assigned_to === ctx.user.id;
  const hasAssignee = !!conv.assigned_to;
  const canReassign = ctx.role === "owner" || ctx.role === "manager";

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <header className="border-b border-mist px-5 py-3 flex items-center gap-3 bg-white">
        <Avatar name={displayName} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-medium text-ink truncate">
            {displayName}
          </div>
          <div className="text-[12px] text-deep/60 truncate">
            {counterpart?.email || conv.external_ref || "—"}
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-mist/60 border border-mist px-3 py-1 text-[11px] text-deep/70">
          <span className="h-1.5 w-1.5 rounded-full bg-deep/50" />
          <span className="font-medium text-ink">{inboxName}</span>
        </div>

        {assignee && (
          <AssigneeChip
            displayName={assignee.display_name}
            status={assignee.status}
            skills={assignee.skills}
          />
        )}

        <ClaimButton
          conversationId={conv.id}
          assignedToMe={assignedToMe}
          hasAssignee={hasAssignee}
          canReassign={canReassign}
          transferTargets={transferTargets}
        />

        {/* Reuse the existing status dropdown — same behaviour the inbox
         *  uses. It's owner-gated server-side; for agents the End button
         *  above provides the only status flip they need (→ done). */}
        {ctx.role === "owner" && (
          <StatusDropdown
            conversationId={conv.id}
            currentStatus={conv.status as ConversationStatus}
            siblingInboxes={siblingsRes.data ?? []}
            currentTransferredNote={conv.transferred_note}
          />
        )}
      </header>

      <div className="flex-1 min-h-0 flex flex-col">
        <ThreadView
          conversationId={conv.id}
          currentUserId={ctx.user.id}
          initialMessages={initialMessages}
        />
      </div>

    </div>
  );
}
