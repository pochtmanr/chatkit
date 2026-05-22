import { redirect } from "next/navigation";
import { requireActiveContext } from "@/lib/active-context";
import {
  listAgentSessionsForRange,
  totalOnlineSeconds,
  type SessionRow,
} from "@/lib/agent-sessions";
import { getServiceClient } from "@/lib/supabase/server";
import { listAgents, requireRole } from "@/lib/team";
import { TeamTimeline } from "./_components/TeamTimeline";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ day?: string }>;

function isoDay(input: string | undefined): { fromIso: string; toIso: string; dayIso: string } {
  const today = new Date();
  let day = today;
  if (input && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const candidate = new Date(`${input}T00:00:00`);
    if (!Number.isNaN(candidate.getTime())) day = candidate;
  }
  day.setHours(0, 0, 0, 0);
  const from = new Date(day);
  const to = new Date(day);
  to.setHours(24, 0, 0, 0);
  const yyyy = day.getFullYear();
  const mm = String(day.getMonth() + 1).padStart(2, "0");
  const dd = String(day.getDate()).padStart(2, "0");
  return {
    fromIso: from.toISOString(),
    toIso: to.toISOString(),
    dayIso: `${yyyy}-${mm}-${dd}`,
  };
}

export default async function TeamDashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const ctx = await requireActiveContext();
  const guard = await requireRole(ctx.business.id, "manager");
  if (!guard.ok) redirect("/workbench");

  const params = await searchParams;
  const { fromIso, toIso, dayIso } = isoDay(params.day);
  const nowIso = new Date().toISOString();

  const agents = await listAgents(ctx.business.id);
  const acceptedAgents = agents.filter((a) => a.accepted_at !== null);

  const sessions = await listAgentSessionsForRange({
    businessId: ctx.business.id,
    fromIso,
    toIso,
  });

  // Today's claim counts per agent: conversations.assigned_to set within
  // the window. We count by assignment, not by message activity, so it
  // tracks workload distribution rather than throughput.
  const admin = getServiceClient();
  const { data: claims } = await admin
    .from("conversations")
    .select("assigned_to, assigned_at")
    .eq("tenant_id", ctx.business.id)
    .not("assigned_to", "is", null)
    .gte("assigned_at", fromIso)
    .lt("assigned_at", toIso);

  const claimsByUser = new Map<string, number>();
  for (const row of claims ?? []) {
    if (!row.assigned_to) continue;
    claimsByUser.set(
      row.assigned_to,
      (claimsByUser.get(row.assigned_to) ?? 0) + 1,
    );
  }

  const sessionsByAgent = new Map<string, SessionRow[]>();
  for (const s of sessions) {
    const list = sessionsByAgent.get(s.support_agent_id) ?? [];
    list.push(s);
    sessionsByAgent.set(s.support_agent_id, list);
  }

  const rows = acceptedAgents.map((a) => {
    const agentSessions = sessionsByAgent.get(a.id) ?? [];
    return {
      id: a.id,
      userId: a.user_id,
      displayName: a.display_name,
      avatarUrl: a.avatar_url,
      role: a.role,
      status: a.status,
      sessions: agentSessions,
      onlineSeconds: totalOnlineSeconds(agentSessions, fromIso, toIso, nowIso),
      claims: claimsByUser.get(a.user_id) ?? 0,
    };
  });

  const onlineNow = rows.filter((r) => r.status === "online").length;
  const awayNow = rows.filter((r) => r.status === "away").length;
  const offlineNow = rows.filter((r) => r.status === "offline").length;
  const totalSeconds = rows.reduce((acc, r) => acc + r.onlineSeconds, 0);
  const avgSeconds = rows.length === 0 ? 0 : Math.round(totalSeconds / rows.length);

  return (
    <TeamTimeline
      businessName={ctx.business.name}
      dayIso={dayIso}
      fromIso={fromIso}
      toIso={toIso}
      nowIso={nowIso}
      stats={{
        onlineNow,
        awayNow,
        offlineNow,
        avgOnlineSeconds: avgSeconds,
        teamSize: rows.length,
      }}
      rows={rows}
    />
  );
}
