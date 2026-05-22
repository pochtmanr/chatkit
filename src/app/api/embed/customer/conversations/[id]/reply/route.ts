import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { broadcastMessage, broadcastStatus } from "@/lib/realtime";
import { authCustomer, assertCustomerOwnsConversation } from "@/lib/customer-auth";
import {
  fireConversationStatusChanged,
  fireTenantWebhook,
} from "@/lib/tenant-webhook";
import { updateConversationStatusFromMessage } from "@/lib/conversation-status-server";

/**
 * POST /api/embed/customer/conversations/:id/reply
 *
 * Customer-side message send. sender_id is always claims.sub — the
 * caller can't impersonate someone else by passing it in the body.
 * Direction is "inbound" for status/webhook routing since the message
 * originates with the end user.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authCustomer(request);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const { id: conversationId } = await params;
  const ownership = await assertCustomerOwnsConversation(session, conversationId);
  if (!ownership.ok) return ownership.response;
  const conv = ownership.conversation;

  let payload: { body?: string; media_url?: string; message_type?: "text" | "image" };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const body = (payload.body ?? "").trim();
  const mediaUrl = payload.media_url?.trim() || null;
  const messageType: "text" | "image" =
    payload.message_type === "image" || (mediaUrl && !body) ? "image" : "text";
  if (!body && !mediaUrl) {
    return NextResponse.json(
      { error: "body or media_url required" },
      { status: 400 },
    );
  }

  const senderId = session.claims.sub;
  const service = getServiceClient();

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
    return NextResponse.json({ error: "send failed" }, { status: 500 });
  }

  const statusChange = await updateConversationStatusFromMessage({
    conversationId,
    direction: "inbound",
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
      `[embed/customer/reply] broadcast failed for ${conversationId}:`,
      err,
    );
  }

  fireTenantWebhook(conv.tenant_id, {
    conversationId,
    senderId,
    body: body || null,
    mediaUrl,
  }).catch((err) =>
    console.warn("[embed/customer/reply] webhook fire failed:", err),
  );

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
