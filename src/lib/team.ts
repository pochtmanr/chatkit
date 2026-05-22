import "server-only";
import { getServerClient, getServiceClient } from "@/lib/supabase/server";

export type TeamRole = "owner" | "manager" | "agent";

export type RoleGuardResult =
  | { ok: true; userId: string; role: TeamRole; agentId: string | null }
  | { ok: false; error: string };

const ROLE_RANK: Record<TeamRole, number> = {
  agent: 1,
  manager: 2,
  owner: 3,
};

/** Human label for a role. `owner` renders as "Admin" — the column stays
 *  named `owner` in the DB (it's implicit via businesses.owner_user_id),
 *  but the in-product name is Admin. */
export function formatRoleLabel(role: TeamRole): string {
  if (role === "owner") return "Admin";
  if (role === "manager") return "Manager";
  return "Agent";
}

export interface SupportAgent {
  id: string;
  user_id: string;
  business_id: string;
  display_name: string;
  avatar_url: string | null;
  role: "agent" | "manager";
  status: "online" | "away" | "offline";
  status_changed_at: string;
  invited_at: string;
  accepted_at: string | null;
  archived_at: string | null;
  skills: string[];
}

type AgentRow = {
  id: string;
  user_id: string;
  business_id: string;
  display_name: string;
  avatar_url: string | null;
  role: string;
  status: string;
  status_changed_at: string;
  invited_at: string;
  accepted_at: string | null;
  archived_at: string | null;
  skills: string[] | null;
};

function toSupportAgent(row: AgentRow): SupportAgent {
  return {
    id: row.id,
    user_id: row.user_id,
    business_id: row.business_id,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    role: row.role === "manager" ? "manager" : "agent",
    status:
      row.status === "online" || row.status === "away" ? row.status : "offline",
    status_changed_at: row.status_changed_at,
    invited_at: row.invited_at,
    accepted_at: row.accepted_at,
    archived_at: row.archived_at,
    skills: Array.isArray(row.skills) ? row.skills : [],
  };
}

/**
 * Resolves the caller's role for `businessId` and enforces a minimum.
 *
 * Resolution order:
 *   1. owner — businesses.owner_user_id matches auth.uid()
 *   2. lead / agent — accepted, non-archived row in support_agents
 *
 * RLS is bypassed via the service client because most callers are
 * server actions; the guard itself enforces the policy.
 */
export async function requireRole(
  businessId: string,
  minRole: TeamRole,
): Promise<RoleGuardResult> {
  const sb = await getServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "not signed in" };

  const admin = getServiceClient();
  const { data: biz } = await admin
    .from("businesses")
    .select("id, owner_user_id")
    .eq("id", businessId)
    .maybeSingle();
  if (!biz) return { ok: false, error: "business not found" };

  if (biz.owner_user_id === user.id) {
    if (ROLE_RANK.owner < ROLE_RANK[minRole]) {
      return { ok: false, error: "forbidden" };
    }
    return { ok: true, userId: user.id, role: "owner", agentId: null };
  }

  const { data: agentRow } = await admin
    .from("support_agents")
    .select("id, role")
    .eq("business_id", businessId)
    .eq("user_id", user.id)
    .is("archived_at", null)
    .not("accepted_at", "is", null)
    .maybeSingle();
  if (!agentRow) return { ok: false, error: "forbidden" };

  const role: TeamRole = agentRow.role === "manager" ? "manager" : "agent";
  if (ROLE_RANK[role] < ROLE_RANK[minRole]) {
    return { ok: false, error: "forbidden" };
  }
  return { ok: true, userId: user.id, role, agentId: agentRow.id };
}

export async function getRoleForBusiness(
  businessId: string,
): Promise<TeamRole | null> {
  const sb = await getServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  const admin = getServiceClient();
  const { data: biz } = await admin
    .from("businesses")
    .select("owner_user_id")
    .eq("id", businessId)
    .maybeSingle();
  if (!biz) return null;
  if (biz.owner_user_id === user.id) return "owner";

  const { data: agentRow } = await admin
    .from("support_agents")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", user.id)
    .is("archived_at", null)
    .not("accepted_at", "is", null)
    .maybeSingle();
  if (!agentRow) return null;
  return agentRow.role === "manager" ? "manager" : "agent";
}

export async function listAgents(
  businessId: string,
): Promise<SupportAgent[]> {
  const admin = getServiceClient();
  const { data } = await admin
    .from("support_agents")
    .select(
      "id, user_id, business_id, display_name, avatar_url, role, status, status_changed_at, invited_at, accepted_at, archived_at, skills",
    )
    .eq("business_id", businessId)
    .is("archived_at", null)
    .order("invited_at", { ascending: true });
  return (data ?? []).map((r) => toSupportAgent(r as AgentRow));
}

export async function getAgent(agentId: string): Promise<SupportAgent | null> {
  const admin = getServiceClient();
  const { data } = await admin
    .from("support_agents")
    .select(
      "id, user_id, business_id, display_name, avatar_url, role, status, status_changed_at, invited_at, accepted_at, archived_at, skills",
    )
    .eq("id", agentId)
    .maybeSingle();
  return data ? toSupportAgent(data as AgentRow) : null;
}

export async function getAgentForUser(
  businessId: string,
  userId: string,
): Promise<SupportAgent | null> {
  const admin = getServiceClient();
  const { data } = await admin
    .from("support_agents")
    .select(
      "id, user_id, business_id, display_name, avatar_url, role, status, status_changed_at, invited_at, accepted_at, archived_at, skills",
    )
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .is("archived_at", null)
    .maybeSingle();
  return data ? toSupportAgent(data as AgentRow) : null;
}

export async function setAgentStatus(
  agentId: string,
  status: "online" | "away" | "offline",
): Promise<void> {
  const admin = getServiceClient();
  await admin
    .from("support_agents")
    .update({ status, status_changed_at: new Date().toISOString() })
    .eq("id", agentId);
}

/**
 * Visitor-facing summary of the agent assigned to a conversation.
 *
 * Joined by (business_id, user_id) so an `assigned_to` value that points
 * at someone who is no longer an active agent for the business resolves
 * to null rather than leaking a stale identity. Returns null for any
 * archived row.
 */
export async function getAssignedAgentSummary(
  businessId: string,
  userId: string,
): Promise<{ display_name: string; avatar_url: string | null } | null> {
  const admin = getServiceClient();
  const { data } = await admin
    .from("support_agents")
    .select("display_name, avatar_url")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .is("archived_at", null)
    .maybeSingle();
  if (!data) return null;
  return { display_name: data.display_name, avatar_url: data.avatar_url };
}
