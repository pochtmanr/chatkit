import { redirect } from "next/navigation";
import { requireActiveContext } from "@/lib/active-context";
import { getServiceClient } from "@/lib/supabase/server";
import { listAgents, requireRole } from "@/lib/team";
import { TeamSettings } from "@/app/dashboard/_components/settings/TeamSettings";

export const dynamic = "force-dynamic";

type PendingInvite = {
  id: string;
  email: string;
  display_name: string;
  role: "agent" | "manager";
  created_at: string;
  expires_at: string;
};

type AgentRow = {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  role: "agent" | "manager";
  status: "online" | "away" | "offline";
  status_changed_at: string;
  accepted_at: string | null;
  is_self: boolean;
  skills: string[];
};

export default async function SettingsTeamPage() {
  const ctx = await requireActiveContext();
  const guard = await requireRole(ctx.business.id, "manager");
  if (!guard.ok) redirect("/workbench");

  const admin = getServiceClient();
  const { data: ownerRow } = await admin
    .from("businesses")
    .select("owner_user_id")
    .eq("id", ctx.business.id)
    .single();
  const ownerUserId = ownerRow?.owner_user_id ?? null;

  const { data: pendingData } = await admin
    .from("invitations")
    .select("id, email, display_name, role, created_at, expires_at")
    .eq("business_id", ctx.business.id)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  const pending: PendingInvite[] = (pendingData ?? []).map((r) => ({
    id: r.id,
    email: r.email,
    display_name: r.display_name,
    role: r.role === "manager" ? "manager" : "agent",
    created_at: r.created_at,
    expires_at: r.expires_at,
  }));

  const agents = await listAgents(ctx.business.id);
  const acceptedAgents = agents.filter((a) => a.accepted_at !== null);

  // Resolve agent emails by joining through auth.admin.listUsers — RLS
  // doesn't let us select from auth.users directly even with service
  // client `.from('auth.users')`.
  const userIds = new Set(acceptedAgents.map((a) => a.user_id));
  if (ownerUserId) userIds.add(ownerUserId);
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailByUserId = new Map<string, string>();
  (users?.users ?? []).forEach((u) => {
    if (u.email && userIds.has(u.id)) {
      emailByUserId.set(u.id, u.email);
    }
  });

  const agentRows: AgentRow[] = acceptedAgents.map((a) => ({
    id: a.id,
    user_id: a.user_id,
    display_name: a.display_name,
    email: emailByUserId.get(a.user_id) ?? "(unknown)",
    avatar_url: a.avatar_url,
    role: a.role,
    status: a.status,
    status_changed_at: a.status_changed_at,
    accepted_at: a.accepted_at,
    is_self: a.user_id === guard.userId,
    skills: a.skills,
  }));

  return (
    <TeamSettings
      businessName={ctx.business.name}
      ownerEmail={ownerUserId ? emailByUserId.get(ownerUserId) ?? null : null}
      pending={pending}
      agents={agentRows}
      callerRole={guard.role}
    />
  );
}
