"use server";

import { revalidatePath } from "next/cache";
import {
  closeAgentSession,
  openAgentSession,
} from "@/lib/agent-sessions";
import { getServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/team";
import { requireWorkbenchContext } from "@/lib/workbench-context";

export type AgentStatus = "online" | "away" | "offline";

type StatusResult = {
  status: AgentStatus;
  agentId: string | null;
};

const STATUSES: readonly AgentStatus[] = ["online", "away", "offline"];

function normaliseStatus(raw: string | null | undefined): AgentStatus {
  return STATUSES.includes(raw as AgentStatus) ? (raw as AgentStatus) : "offline";
}

/** Returns the caller's status on their support_agents row for the active
 *  business. Returns offline + null agentId when the caller has no agent
 *  row (typical for admins who never invited themselves). */
export async function getOwnStatus(): Promise<StatusResult> {
  const ctx = await requireWorkbenchContext();
  if (!ctx.agentId) return { status: "offline", agentId: null };

  const admin = getServiceClient();
  const { data } = await admin
    .from("support_agents")
    .select("status")
    .eq("id", ctx.agentId)
    .maybeSingle();
  return {
    status: normaliseStatus(data?.status),
    agentId: ctx.agentId,
  };
}

/** Flips the caller's status on the active business's support_agents row.
 *  Side-effect: opens or closes the agent_sessions row that powers the
 *  timeline. Returns silently when the caller isn't an agent — the toggle
 *  is hidden in the UI for non-agents, but the action stays idempotent. */
export async function setStatus(status: AgentStatus): Promise<void> {
  if (!STATUSES.includes(status)) return;
  const ctx = await requireWorkbenchContext();
  const guard = await requireRole(ctx.business.id, "agent");
  if (!guard.ok || !guard.agentId) return;

  const admin = getServiceClient();

  const { data: prior } = await admin
    .from("support_agents")
    .select("status")
    .eq("id", guard.agentId)
    .maybeSingle();
  const priorStatus = normaliseStatus(prior?.status);
  if (priorStatus === status) return;

  await admin
    .from("support_agents")
    .update({ status, status_changed_at: new Date().toISOString() })
    .eq("id", guard.agentId);

  if (status === "online") {
    await openAgentSession({
      supportAgentId: guard.agentId,
      businessId: ctx.business.id,
    });
  } else if (priorStatus === "online") {
    await closeAgentSession({
      supportAgentId: guard.agentId,
      reason: "manual",
    });
  }

  revalidatePath("/workbench", "layout");
}

/** 60-second heartbeat from the browser. Bumps status_changed_at on the
 *  support_agents row and forward-rolls any open agent_sessions row's
 *  implicit "alive at" timestamp so the staleness sweeper doesn't close
 *  an actively-online agent's session. */
export async function tick(): Promise<void> {
  const ctx = await requireWorkbenchContext();
  if (!ctx.agentId) return;
  const admin = getServiceClient();
  await admin
    .from("support_agents")
    .update({ status_changed_at: new Date().toISOString() })
    .eq("id", ctx.agentId)
    .eq("status", "online");
}
