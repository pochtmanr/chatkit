import "server-only";
import { getServiceClient } from "@/lib/supabase/server";

export type SessionRow = {
  id: string;
  support_agent_id: string;
  business_id: string;
  started_at: string;
  ended_at: string | null;
  ended_reason: "manual" | "stale" | "transition" | null;
};

type RawSessionRow = {
  id: string;
  support_agent_id: string;
  business_id: string;
  started_at: string;
  ended_at: string | null;
  ended_reason: string | null;
};

function toSessionRow(row: RawSessionRow): SessionRow {
  let reason: SessionRow["ended_reason"] = null;
  if (
    row.ended_reason === "manual" ||
    row.ended_reason === "stale" ||
    row.ended_reason === "transition"
  ) {
    reason = row.ended_reason;
  }
  return {
    id: row.id,
    support_agent_id: row.support_agent_id,
    business_id: row.business_id,
    started_at: row.started_at,
    ended_at: row.ended_at,
    ended_reason: reason,
  };
}

/** Opens a new online-session row. Returns the row id. Idempotent in the
 *  sense that if a row is already open for this agent, the existing one
 *  is returned and no second row is created. */
export async function openAgentSession(args: {
  supportAgentId: string;
  businessId: string;
}): Promise<string> {
  const admin = getServiceClient();

  const { data: open } = await admin
    .from("agent_sessions")
    .select("id")
    .eq("support_agent_id", args.supportAgentId)
    .is("ended_at", null)
    .maybeSingle();
  if (open) return open.id;

  const { data, error } = await admin
    .from("agent_sessions")
    .insert({
      support_agent_id: args.supportAgentId,
      business_id: args.businessId,
      started_at: new Date().toISOString(),
      status: "online",
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "couldn't open agent session");
  }
  return data.id;
}

/** Closes any open session for this agent. No-ops if none is open. */
export async function closeAgentSession(args: {
  supportAgentId: string;
  reason: "manual" | "stale" | "transition";
}): Promise<void> {
  const admin = getServiceClient();
  await admin
    .from("agent_sessions")
    .update({
      ended_at: new Date().toISOString(),
      ended_reason: args.reason,
    })
    .eq("support_agent_id", args.supportAgentId)
    .is("ended_at", null);
}

/** Force-closes any session whose presence heartbeat has not advanced in
 *  the past `staleSeconds`. Called opportunistically from the workbench
 *  queue poll so we don't need a cron job for this. */
export async function sweepStaleAgentSessions(
  businessId: string,
  staleSeconds = 300,
): Promise<void> {
  const admin = getServiceClient();
  // Find open sessions whose owning agent's status_changed_at is older
  // than the staleness threshold. Done in two queries because the
  // service client doesn't support join-with-update over multiple
  // tables.
  const cutoffIso = new Date(Date.now() - staleSeconds * 1000).toISOString();
  const { data: stale } = await admin
    .from("agent_sessions")
    .select("id, support_agent_id, support_agents:support_agent_id(status_changed_at, status)")
    .eq("business_id", businessId)
    .is("ended_at", null);
  if (!stale || stale.length === 0) return;

  type StaleRow = {
    id: string;
    support_agent_id: string;
    support_agents:
      | { status_changed_at: string; status: string }
      | { status_changed_at: string; status: string }[]
      | null;
  };

  const toClose: string[] = [];
  for (const row of stale as StaleRow[]) {
    const agent = Array.isArray(row.support_agents)
      ? row.support_agents[0]
      : row.support_agents;
    if (!agent) continue;
    if (agent.status !== "online" || agent.status_changed_at < cutoffIso) {
      toClose.push(row.id);
    }
  }
  if (toClose.length === 0) return;
  await admin
    .from("agent_sessions")
    .update({
      ended_at: new Date().toISOString(),
      ended_reason: "stale",
    })
    .in("id", toClose);
}

export async function listAgentSessionsForRange(args: {
  businessId: string;
  fromIso: string;
  toIso: string;
}): Promise<SessionRow[]> {
  const admin = getServiceClient();
  const { data } = await admin
    .from("agent_sessions")
    .select("id, support_agent_id, business_id, started_at, ended_at, ended_reason")
    .eq("business_id", args.businessId)
    .lt("started_at", args.toIso)
    .or(`ended_at.is.null,ended_at.gt.${args.fromIso}`)
    .order("started_at", { ascending: true });
  return (data ?? []).map((r) => toSessionRow(r as RawSessionRow));
}

export async function listOwnSessionsForRange(args: {
  supportAgentId: string;
  fromIso: string;
  toIso: string;
}): Promise<SessionRow[]> {
  const admin = getServiceClient();
  const { data } = await admin
    .from("agent_sessions")
    .select("id, support_agent_id, business_id, started_at, ended_at, ended_reason")
    .eq("support_agent_id", args.supportAgentId)
    .lt("started_at", args.toIso)
    .or(`ended_at.is.null,ended_at.gt.${args.fromIso}`)
    .order("started_at", { ascending: true });
  return (data ?? []).map((r) => toSessionRow(r as RawSessionRow));
}

/** Sums online seconds for a list of sessions, clamped to [from, to]. */
export function totalOnlineSeconds(
  sessions: SessionRow[],
  fromIso: string,
  toIso: string,
  nowIso: string = new Date().toISOString(),
): number {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  const now = Date.parse(nowIso);
  let total = 0;
  for (const s of sessions) {
    const start = Math.max(Date.parse(s.started_at), from);
    const endRaw = s.ended_at ? Date.parse(s.ended_at) : now;
    const end = Math.min(endRaw, to);
    if (end > start) total += (end - start) / 1000;
  }
  return Math.round(total);
}
