import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { broadcastMessage } from "@/lib/realtime";
import { verifyEmbedKey } from "@/lib/embed-auth";

/**
 * PATCH  /api/embed/conversations/:id/messages/:msgId
 *   Edit a message body. Allowed only on agent-authored messages
 *   (sender_id starts with `agent`) so a leaked API key can't rewrite
 *   the customer's words.
 *
 * DELETE /api/embed/conversations/:id/messages/:msgId
 *   Soft-delete (sets deleted_at). Same agent-only guard.
 *
 * Both broadcast the updated message over Realtime so other open
 * widgets see the change immediately.
 */

async function authAndScope(
  request: NextRequest,
  conversationId: string,
  msgId: string,
) {
  const auth = request.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return {
      err: NextResponse.json({ error: "missing bearer key" }, { status: 401 }),
    };
  }
  let session;
  try {
    session = await verifyEmbedKey(m[1]);
  } catch (err) {
    return {
      err: NextResponse.json(
        { error: err instanceof Error ? err.message : "invalid key" },
        { status: 401 },
      ),
    };
  }

  const service = getServiceClient();
  const { data: existing } = await service
    .from("messages")
    .select("id, conversation_id, tenant_id, sender_id, body, media_url, message_type")
    .eq("id", msgId)
    .eq("conversation_id", conversationId)
    .eq("tenant_id", session.tenantId)
    .maybeSingle();
  if (!existing) {
    return {
      err: NextResponse.json({ error: "message not found" }, { status: 404 }),
    };
  }
  // Agent guard: only messages our admins authored are mutable from
  // this endpoint. Customer messages stay untouched.
  if (!String(existing.sender_id || "").startsWith("agent")) {
    return {
      err: NextResponse.json(
        { error: "only agent messages can be edited or deleted" },
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
  const auth = await authAndScope(request, conversationId, msgId);
  if ("err" in auth) return auth.err;

  let payload: { body?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const body = (payload.body ?? "").trim();
  if (!body) {
    return NextResponse.json({ error: "body required" }, { status: 400 });
  }

  const { data: updated, error } = await auth.service
    .from("messages")
    .update({ body, edited_at: new Date().toISOString() })
    .eq("id", msgId)
    .select()
    .single();
  if (error || !updated) {
    return NextResponse.json(
      { error: error?.message ?? "update failed" },
      { status: 500 },
    );
  }

  try {
    await broadcastMessage(conversationId, updated);
  } catch (err) {
    console.warn("[embed/messages/PATCH] broadcast failed:", err);
  }
  return NextResponse.json({ message: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; msgId: string }> },
) {
  const { id: conversationId, msgId } = await params;
  const auth = await authAndScope(request, conversationId, msgId);
  if ("err" in auth) return auth.err;

  // Soft-delete so a re-fetch hides the row but the audit trail stays.
  const { data: updated, error } = await auth.service
    .from("messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", msgId)
    .select()
    .single();
  if (error || !updated) {
    return NextResponse.json(
      { error: error?.message ?? "delete failed" },
      { status: 500 },
    );
  }

  try {
    await broadcastMessage(conversationId, { ...updated, deleted: true });
  } catch (err) {
    console.warn("[embed/messages/DELETE] broadcast failed:", err);
  }
  return NextResponse.json({ ok: true });
}
