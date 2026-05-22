import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { broadcastMessage } from "@/lib/realtime";
import { authCustomer, assertCustomerOwnsConversation } from "@/lib/customer-auth";

/**
 * PATCH  /api/embed/customer/conversations/:id/messages/:msgId
 *   Edit a message body. Only the original sender (matched by
 *   sender_id == claims.sub) may edit. Agent-authored messages — which
 *   the dashboard or workbench owns — are immutable from this surface.
 *
 * DELETE /api/embed/customer/conversations/:id/messages/:msgId
 *   Soft-delete (sets deleted_at). Same sender-only guard.
 *
 * Both broadcast over Realtime so other open clients see the update
 * immediately.
 */

async function loadOwnMessage(
  request: NextRequest,
  conversationId: string,
  msgId: string,
) {
  const auth = await authCustomer(request);
  if (!auth.ok) return { err: auth.response };
  const { session } = auth;

  const ownership = await assertCustomerOwnsConversation(session, conversationId);
  if (!ownership.ok) return { err: ownership.response };

  const service = getServiceClient();
  const { data: existing } = await service
    .from("messages")
    .select("id, conversation_id, tenant_id, sender_id, body, media_url, message_type")
    .eq("id", msgId)
    .eq("conversation_id", conversationId)
    .eq("tenant_id", session.tenantId)
    .maybeSingle();
  if (!existing) {
    return { err: NextResponse.json({ error: "message not found" }, { status: 404 }) };
  }
  if (existing.sender_id !== session.claims.sub) {
    return {
      err: NextResponse.json(
        { error: "only your own messages can be edited or deleted" },
        { status: 403 },
      ),
    };
  }
  return { session, service, existing };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; msgId: string }> },
) {
  const { id: conversationId, msgId } = await params;
  const ctx = await loadOwnMessage(request, conversationId, msgId);
  if ("err" in ctx) return ctx.err;

  let payload: { body?: string };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const body = (payload.body ?? "").trim();
  if (!body) {
    return NextResponse.json({ error: "body required" }, { status: 400 });
  }

  const { data: updated, error } = await ctx.service
    .from("messages")
    .update({ body, edited_at: new Date().toISOString() })
    .eq("id", msgId)
    .select()
    .single();
  if (error || !updated) {
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }

  try {
    await broadcastMessage(conversationId, updated);
  } catch (err) {
    console.warn("[embed/customer/messages/PATCH] broadcast failed:", err);
  }
  return NextResponse.json({ message: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; msgId: string }> },
) {
  const { id: conversationId, msgId } = await params;
  const ctx = await loadOwnMessage(request, conversationId, msgId);
  if ("err" in ctx) return ctx.err;

  const { data: updated, error } = await ctx.service
    .from("messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", msgId)
    .select()
    .single();
  if (error || !updated) {
    return NextResponse.json({ error: "delete failed" }, { status: 500 });
  }

  try {
    await broadcastMessage(conversationId, { ...updated, deleted: true });
  } catch (err) {
    console.warn("[embed/customer/messages/DELETE] broadcast failed:", err);
  }
  return NextResponse.json({ ok: true });
}
