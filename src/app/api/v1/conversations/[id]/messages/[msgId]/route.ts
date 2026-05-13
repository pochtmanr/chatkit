import { NextResponse, type NextRequest } from "next/server";
import { authTenant, corsHeaders } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase/server";
import { broadcastMessage } from "@/lib/realtime";

/**
 * PATCH  /api/v1/conversations/:id/messages/:msgId
 *   Edit a message. Body: { sender_id, body }.
 *   Only the original sender (matched on sender_id) can edit their
 *   own messages — same agent guard idea as the embed endpoint but
 *   on the SDK side it's the customer's own messages.
 *
 * DELETE /api/v1/conversations/:id/messages/:msgId
 *   Soft delete. Body: { sender_id }. Same ownership check.
 *
 * Both broadcast over Realtime so other clients update live.
 */

async function authScope(
  request: NextRequest,
  conversationId: string,
  msgId: string,
) {
  const auth = await authTenant(request);
  if ("error" in auth) return { err: auth.error };

  const service = getServiceClient();
  const { data: existing } = await service
    .from("messages")
    .select("id, conversation_id, tenant_id, sender_id, body, media_url, message_type")
    .eq("id", msgId)
    .eq("conversation_id", conversationId)
    .eq("tenant_id", auth.tenant.id)
    .maybeSingle();
  if (!existing) {
    return {
      err: NextResponse.json(
        { error: "message not found" },
        { status: 404, headers: corsHeaders },
      ),
    };
  }
  return { service, existing };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; msgId: string }> },
) {
  const { id: conversationId, msgId } = await params;
  const scope = await authScope(request, conversationId, msgId);
  if ("err" in scope) return scope.err;

  let payload: { sender_id?: string; body?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid json" },
      { status: 400, headers: corsHeaders },
    );
  }
  const body = (payload.body ?? "").trim();
  if (!payload.sender_id || !body) {
    return NextResponse.json(
      { error: "sender_id + body required" },
      { status: 400, headers: corsHeaders },
    );
  }
  if (scope.existing.sender_id !== payload.sender_id) {
    return NextResponse.json(
      { error: "not the original sender" },
      { status: 403, headers: corsHeaders },
    );
  }

  const { data: updated, error } = await scope.service
    .from("messages")
    .update({ body, edited_at: new Date().toISOString() })
    .eq("id", msgId)
    .select()
    .single();
  if (error || !updated) {
    return NextResponse.json(
      { error: error?.message ?? "update failed" },
      { status: 500, headers: corsHeaders },
    );
  }

  try {
    await broadcastMessage(conversationId, updated);
  } catch (err) {
    console.warn("[v1/messages/PATCH] broadcast failed:", err);
  }
  return NextResponse.json({ message: updated }, { headers: corsHeaders });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; msgId: string }> },
) {
  const { id: conversationId, msgId } = await params;
  const scope = await authScope(request, conversationId, msgId);
  if ("err" in scope) return scope.err;

  let payload: { sender_id?: string };
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }
  if (!payload.sender_id) {
    return NextResponse.json(
      { error: "sender_id required" },
      { status: 400, headers: corsHeaders },
    );
  }
  if (scope.existing.sender_id !== payload.sender_id) {
    return NextResponse.json(
      { error: "not the original sender" },
      { status: 403, headers: corsHeaders },
    );
  }

  const { data: updated, error } = await scope.service
    .from("messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", msgId)
    .select()
    .single();
  if (error || !updated) {
    return NextResponse.json(
      { error: error?.message ?? "delete failed" },
      { status: 500, headers: corsHeaders },
    );
  }

  try {
    await broadcastMessage(conversationId, { ...updated, deleted: true });
  } catch (err) {
    console.warn("[v1/messages/DELETE] broadcast failed:", err);
  }
  return NextResponse.json({ ok: true }, { headers: corsHeaders });
}

export function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}
