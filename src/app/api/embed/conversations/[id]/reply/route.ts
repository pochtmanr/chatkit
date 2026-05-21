import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { broadcastMessage, broadcastStatus } from "@/lib/realtime";
import { verifyEmbedKey } from "@/lib/embed-auth";
import {
  fireConversationStatusChanged,
  fireTenantWebhook,
} from "@/lib/tenant-webhook";
import { updateConversationStatusFromMessage } from "@/lib/conversation-status-server";

/**
 * Embed-mode reply endpoint.
 *
 * Auth: tenant API key in the Authorization header (`Bearer pk_live_...`)
 * + Origin/Referer check against the configured allowlist. The same
 * key the iframe URL carries.
 *
 * Per-admin identity isn't carried — every reply lands as `agent`. If
 * we ever need per-admin attribution we can layer a JWT sub-claim or
 * a separate header without changing this contract.
 */

const AGENT_SENDER_ID = "agent";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = request.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return NextResponse.json(
      { error: "missing bearer key" },
      { status: 401 },
    );
  }
  let session;
  try {
    session = await verifyEmbedKey(m[1]);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "invalid key" },
      { status: 401 },
    );
  }

  const { id: conversationId } = await params;

  let payload: {
    body?: string;
    media_url?: string;
    message_type?: "text" | "image";
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const body = (payload.body ?? "").trim();
  const mediaUrl = payload.media_url?.trim() || null;
  const messageType: "text" | "image" =
    payload.message_type === "image" || (mediaUrl && !body)
      ? "image"
      : "text";
  if (!body && !mediaUrl) {
    return NextResponse.json(
      { error: "body or media_url required" },
      { status: 400 },
    );
  }

  const service = getServiceClient();
  // Conversation must belong to the tenant named in the JWT.
  const { data: conv } = await service
    .from("conversations")
    .select("id, tenant_id, kind, external_ref, participants")
    .eq("id", conversationId)
    .eq("tenant_id", session.tenantId)
    .maybeSingle();
  if (!conv) {
    return NextResponse.json(
      { error: "conversation not found" },
      { status: 404 },
    );
  }

  const senderId = AGENT_SENDER_ID;

  const { data: message, error: insErr } = await service
    .from("messages")
    .insert({
      tenant_id: conv.tenant_id,
      conversation_id: conversationId,
      sender_id: senderId,
      receiver_id: null,
      body: body || null,
      message_type: messageType,
      media_url: mediaUrl,
    })
    .select()
    .single();
  if (insErr || !message) {
    return NextResponse.json(
      { error: insErr?.message ?? "insert failed" },
      { status: 500 },
    );
  }

  // sender_id is "agent" (per the embed-iframe agent flow), so direction
  // is outbound for status purposes — consistent with how tenant-webhook
  // infers it from the sender id.
  const statusChange = await updateConversationStatusFromMessage({
    conversationId,
    direction: "outbound",
  });

  await service
    .from("conversations")
    .update({
      last_message: body || (messageType === "image" ? "[image]" : ""),
      last_at: message.created_at,
    })
    .eq("id", conversationId);

  try {
    await broadcastMessage(conversationId, message);
  } catch (err) {
    console.warn(
      `[embed/reply] broadcast failed for ${conversationId}:`,
      err,
    );
  }

  // Fire the generic tenant webhook (the dashboard's "Webhooks"
  // page configures this — separate from the hardcoded isrshipping
  // FCM webhook below).
  fireTenantWebhook(conv.tenant_id, {
    conversationId,
    senderId,
    body: body || null,
    mediaUrl: mediaUrl,
  }).catch((err) => console.warn("[embed/reply] webhook fire failed:", err));

  if (statusChange) {
    const changedAt = new Date().toISOString();
    void fireConversationStatusChanged({
      conversationId,
      previousStatus: statusChange.previous,
      newStatus: statusChange.next,
      changedBy: "system",
      changedByUserId: null,
    });
    void broadcastStatus(conversationId, {
      previousStatus: statusChange.previous,
      newStatus: statusChange.next,
      changedAt,
      changedByUserId: null,
    });
  }

  return NextResponse.json({ message });
}
