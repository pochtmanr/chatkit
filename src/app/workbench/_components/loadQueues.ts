import "server-only";
import { sweepStaleAgentSessions } from "@/lib/agent-sessions";
import { getServiceClient } from "@/lib/supabase/server";
import type { ConversationStatus } from "@/lib/conversation-status";
import type { Inbox } from "@/lib/inboxes";
import type { SupportAgent } from "@/lib/team";
import { listAgents } from "@/lib/team";

export type QueueConversation = {
  id: string;
  inboxId: string;
  inboxName: string;
  status: ConversationStatus;
  statusUpdatedAt: string;
  lastMessage: string | null;
  displayName: string;
  assignedTo: string | null;
};

type RawConversation = {
  id: string;
  inbox_id: string;
  status: string;
  status_updated_at: string;
  last_message: string | null;
  external_ref: string | null;
  tenant_id: string;
  assigned_to: string | null;
};

type LoadArgs = {
  businessId: string;
  userId: string;
  inboxes: Inbox[];
  managerView: boolean;
};

export type LoadedQueues = {
  /** When `managerView` is true, this is grouped by agent (display name +
   *  user id), otherwise it's the caller's personal queue. */
  groups: { agent: SupportAgent | null; rows: QueueConversation[] }[];
  unassigned: QueueConversation[];
};

const OPEN_STATUSES: ConversationStatus[] = [
  "new",
  "active",
  "waiting_customer",
  "waiting_support",
];
const ROW_LIMIT = 50;

/** Loads My Queue + Unassigned for the active workbench context.
 *
 *  My Queue / Manager view both query `conversations` directly (filtered
 *  by assigned_to). The Unassigned rail queries `unassigned_or_stale_view`
 *  so a stale-assigned conversation (reassign_after past now) surfaces
 *  alongside the genuinely unassigned ones. */
export async function loadQueues(args: LoadArgs): Promise<LoadedQueues> {
  const inboxIds = args.inboxes.map((i) => i.id);
  const inboxName = new Map(args.inboxes.map((i) => [i.id, i.name]));
  if (inboxIds.length === 0) {
    return { groups: [], unassigned: [] };
  }

  const admin = getServiceClient();

  // Opportunistic stale-session sweep. The rail polls every 10s, which
  // is the natural cadence for closing out sessions whose owning agent's
  // tab went away. Failing this is non-fatal — the timeline just shows a
  // longer green segment until the next refresh.
  try {
    await sweepStaleAgentSessions(args.businessId);
  } catch {
    // ignore — surfaces in logs via the admin client; not a hard fail
  }

  // Assigned conversations for the active business — used by both My Queue
  // and the manager-view grouping. Filter by open statuses up front so
  // the rail doesn't have to.
  const { data: assignedData } = await admin
    .from("conversations")
    .select(
      "id, inbox_id, status, status_updated_at, last_message, external_ref, tenant_id, assigned_to",
    )
    .eq("tenant_id", args.businessId)
    .in("inbox_id", inboxIds)
    .in("status", OPEN_STATUSES)
    .not("assigned_to", "is", null)
    .order("status_updated_at", { ascending: false, nullsFirst: false })
    .limit(ROW_LIMIT * 4);

  const assignedRows = ((assignedData ?? []) as RawConversation[]);

  // Unassigned + stale view drives the Unassigned rail. Casting through
  // a loose shape because the generated view types use nullable columns
  // (views are inherently nullable in PostgREST), but our query only
  // returns rows with the relevant fields populated.
  const { data: unassignedData } = await admin
    .from("unassigned_or_stale_view")
    .select(
      "id, inbox_id, status, status_updated_at, last_message, external_ref, tenant_id, assigned_to",
    )
    .eq("tenant_id", args.businessId)
    .in("inbox_id", inboxIds)
    .order("status_updated_at", { ascending: true, nullsFirst: false })
    .limit(ROW_LIMIT);
  const unassignedRows = ((unassignedData ?? []) as unknown as RawConversation[])
    // Defensive — the view may include rows whose status isn't actually
    // queueable (legacy migrations); filter on the client to match.
    .filter((r) => OPEN_STATUSES.includes(r.status as ConversationStatus));

  const allRefs = Array.from(
    new Set(
      [...assignedRows, ...unassignedRows]
        .map((r) => r.external_ref)
        .filter((v): v is string => !!v),
    ),
  );
  const userByRef = new Map<string, { name: string | null; email: string | null }>();
  if (allRefs.length) {
    const { data: users } = await admin
      .from("chat_users")
      .select("user_id, name, email")
      .eq("tenant_id", args.businessId)
      .in("user_id", allRefs);
    (users ?? []).forEach((u) =>
      userByRef.set(u.user_id, { name: u.name, email: u.email }),
    );
  }

  function mapRow(r: RawConversation): QueueConversation {
    const u = r.external_ref ? userByRef.get(r.external_ref) : null;
    return {
      id: r.id,
      inboxId: r.inbox_id,
      inboxName: inboxName.get(r.inbox_id) ?? "Inbox",
      status: r.status as ConversationStatus,
      statusUpdatedAt: r.status_updated_at,
      lastMessage: r.last_message,
      displayName: u?.name || u?.email || r.external_ref || r.id.slice(0, 8),
      assignedTo: r.assigned_to,
    };
  }

  if (args.managerView) {
    const agents = await listAgents(args.businessId);
    const byUserId = new Map(agents.map((a) => [a.user_id, a]));
    const grouped = new Map<string, RawConversation[]>();
    for (const r of assignedRows) {
      const key = r.assigned_to ?? "unknown";
      const list = grouped.get(key) ?? [];
      list.push(r);
      grouped.set(key, list);
    }
    const groups = Array.from(grouped.entries())
      .map(([userId, list]) => ({
        agent: byUserId.get(userId) ?? null,
        rows: list
          .sort((a, b) => b.status_updated_at.localeCompare(a.status_updated_at))
          .slice(0, ROW_LIMIT)
          .map(mapRow),
      }))
      .sort((a, b) => {
        const an = a.agent?.display_name ?? "~";
        const bn = b.agent?.display_name ?? "~";
        return an.localeCompare(bn);
      });
    return { groups, unassigned: unassignedRows.map(mapRow) };
  }

  const mine = assignedRows
    .filter((r) => r.assigned_to === args.userId)
    .sort((a, b) => b.status_updated_at.localeCompare(a.status_updated_at))
    .slice(0, ROW_LIMIT)
    .map(mapRow);

  return {
    groups: [{ agent: null, rows: mine }],
    unassigned: unassignedRows.map(mapRow),
  };
}
