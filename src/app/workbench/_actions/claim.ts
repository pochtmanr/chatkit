"use server";

import { revalidatePath } from "next/cache";
import { getServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/team";
import { requireWorkbenchContext } from "@/lib/workbench-context";

type Ok<T = unknown> = { ok: true } & T;
type Err = { ok: false; error: string };
export type ClaimResult<T = unknown> = Ok<T> | Err;

async function loadConversationBusiness(
  conversationId: string,
): Promise<string | null> {
  const admin = getServiceClient();
  const { data } = await admin
    .from("conversations")
    .select("id, tenant_id")
    .eq("id", conversationId)
    .maybeSingle();
  return data?.tenant_id ?? null;
}

async function enqueueAssignmentWebhook(args: {
  conversationId: string;
  previousAgentUserId: string | null;
  newAgentUserId: string | null;
}): Promise<void> {
  const admin = getServiceClient();
  const { data: conv } = await admin
    .from("conversations")
    .select("inbox_id, tenant_id")
    .eq("id", args.conversationId)
    .maybeSingle();
  if (!conv) return;

  let displayName: string | null = null;
  let avatarUrl: string | null = null;
  if (args.newAgentUserId) {
    const { data: agent } = await admin
      .from("support_agents")
      .select("display_name, avatar_url")
      .eq("business_id", conv.tenant_id)
      .eq("user_id", args.newAgentUserId)
      .is("archived_at", null)
      .maybeSingle();
    displayName = agent?.display_name ?? null;
    avatarUrl = agent?.avatar_url ?? null;
  }

  await admin.from("pending_webhooks").insert({
    event_kind: "conversation_assigned",
    inbox_id: conv.inbox_id,
    conversation_id: args.conversationId,
    payload: {
      event: "conversation_assigned",
      tenant_id: conv.tenant_id,
      inbox_id: conv.inbox_id,
      conversation_id: args.conversationId,
      previous_agent_user_id: args.previousAgentUserId,
      new_agent_user_id: args.newAgentUserId,
      new_agent_display_name: displayName,
      new_agent_avatar_url: avatarUrl,
      occurred_at: new Date().toISOString(),
    },
  });
}

/** Marks the active conversation as owned by the caller. Bypasses the
 *  auto-assignment trigger — this is the manual "Claim" path. Enqueues
 *  a conversation_assigned webhook through pending_webhooks so the
 *  cron drainer ships it. */
export async function claimConversation(
  conversationId: string,
): Promise<ClaimResult> {
  const ctx = await requireWorkbenchContext();
  const guard = await requireRole(ctx.business.id, "agent");
  if (!guard.ok) return { ok: false, error: guard.error };

  const bizId = await loadConversationBusiness(conversationId);
  if (!bizId) return { ok: false, error: "conversation not found" };
  if (bizId !== ctx.business.id) {
    return { ok: false, error: "conversation belongs to another business" };
  }

  const admin = getServiceClient();
  // Capture the previous assignee so the webhook can describe the
  // transition (null → caller, or otherUser → caller).
  const { data: prev } = await admin
    .from("conversations")
    .select("assigned_to")
    .eq("id", conversationId)
    .maybeSingle();
  const previousAgent = prev?.assigned_to ?? null;
  if (previousAgent === guard.userId) {
    return { ok: true };
  }

  const now = new Date().toISOString();
  const { error } = await admin
    .from("conversations")
    .update({
      assigned_to: guard.userId,
      assigned_at: now,
      reassign_after: null,
    })
    .eq("id", conversationId);
  if (error) return { ok: false, error: error.message };

  if (guard.agentId) {
    await admin
      .from("support_agents")
      .update({ last_assigned_at: now })
      .eq("id", guard.agentId);
  }

  await enqueueAssignmentWebhook({
    conversationId,
    previousAgentUserId: previousAgent,
    newAgentUserId: guard.userId,
  });

  revalidatePath("/workbench", "layout");
  revalidatePath(`/workbench/${conversationId}`);
  return { ok: true };
}

/** Reassigns to another agent in the same business. The caller must be
 *  an agent (owners qualify); the destination must be an accepted,
 *  non-archived support_agents row. */
export async function transferConversation(
  conversationId: string,
  toUserId: string,
): Promise<ClaimResult> {
  const ctx = await requireWorkbenchContext();
  const guard = await requireRole(ctx.business.id, "agent");
  if (!guard.ok) return { ok: false, error: guard.error };

  const bizId = await loadConversationBusiness(conversationId);
  if (!bizId) return { ok: false, error: "conversation not found" };
  if (bizId !== ctx.business.id) {
    return { ok: false, error: "conversation belongs to another business" };
  }

  const admin = getServiceClient();
  const { data: target } = await admin
    .from("support_agents")
    .select("user_id")
    .eq("business_id", ctx.business.id)
    .eq("user_id", toUserId)
    .is("archived_at", null)
    .not("accepted_at", "is", null)
    .maybeSingle();
  if (!target) return { ok: false, error: "destination agent unavailable" };

  const { data: prev } = await admin
    .from("conversations")
    .select("assigned_to")
    .eq("id", conversationId)
    .maybeSingle();
  const previousAgent = prev?.assigned_to ?? null;

  const now = new Date().toISOString();
  const { error } = await admin
    .from("conversations")
    .update({
      assigned_to: toUserId,
      assigned_at: now,
      reassign_after: null,
    })
    .eq("id", conversationId);
  if (error) return { ok: false, error: error.message };

  await enqueueAssignmentWebhook({
    conversationId,
    previousAgentUserId: previousAgent,
    newAgentUserId: toUserId,
  });

  revalidatePath("/workbench", "layout");
  revalidatePath(`/workbench/${conversationId}`);
  return { ok: true };
}

/** Pops the oldest queue-able unassigned conversation and claims it for
 *  the caller. Returns its id so the UI can navigate. */
export async function claimNextUnassigned(): Promise<
  ClaimResult<{ conversationId: string | null }>
> {
  const ctx = await requireWorkbenchContext();
  const guard = await requireRole(ctx.business.id, "agent");
  if (!guard.ok) return { ok: false, error: guard.error };

  const admin = getServiceClient();
  const inboxIds = ctx.inboxes.map((i) => i.id);
  if (inboxIds.length === 0) {
    return { ok: true, conversationId: null };
  }
  const { data: next } = await admin
    .from("unassigned_or_stale_view")
    .select("id")
    .eq("tenant_id", ctx.business.id)
    .in("inbox_id", inboxIds)
    .order("status_updated_at", { ascending: true, nullsFirst: false })
    .limit(1);
  const target = next?.[0]?.id ?? null;
  if (!target) return { ok: true, conversationId: null };

  const claim = await claimConversation(target);
  if (!claim.ok) return claim;
  return { ok: true, conversationId: target };
}

/** Sets a conversation to 'done'. The existing dashboard action is
 *  owner-only; this is the agent-facing equivalent for the Workbench
 *  "End" button. */
export async function endConversation(
  conversationId: string,
): Promise<ClaimResult> {
  const ctx = await requireWorkbenchContext();
  const guard = await requireRole(ctx.business.id, "agent");
  if (!guard.ok) return { ok: false, error: guard.error };

  const bizId = await loadConversationBusiness(conversationId);
  if (!bizId) return { ok: false, error: "conversation not found" };
  if (bizId !== ctx.business.id) {
    return { ok: false, error: "conversation belongs to another business" };
  }

  const admin = getServiceClient();
  const { error } = await admin
    .from("conversations")
    .update({ status: "done", status_updated_at: new Date().toISOString() })
    .eq("id", conversationId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/workbench", "layout");
  revalidatePath(`/workbench/${conversationId}`);
  return { ok: true };
}
