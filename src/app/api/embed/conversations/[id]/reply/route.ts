import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { broadcastMessage } from "@/lib/realtime";
import { verifyEmbedKey } from "@/lib/embed-auth";

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
const WEBHOOK_URL = "https://www.isrshipping.com/api/webhook-notification";

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

  const service = getServiceClient();
  // Conversation must belong to the tenant named in the JWT.
  const { data: conv } = await service
    .from("conversations")
    .select("id, tenant_id, external_ref")
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
      body,
      message_type: "text",
    })
    .select()
    .single();
  if (insErr || !message) {
    return NextResponse.json(
      { error: insErr?.message ?? "insert failed" },
      { status: 500 },
    );
  }

  await service
    .from("conversations")
    .update({ last_message: body, last_at: message.created_at })
    .eq("id", conversationId);

  try {
    await broadcastMessage(conversationId, message);
  } catch (err) {
    console.warn(
      `[embed/reply] broadcast failed for ${conversationId}:`,
      err,
    );
  }

  // Fire push to the customer via the GoDelivery webhook. Look up the
  // customer's FCM token from chat_users (populated by the SDK) so the
  // webhook doesn't need a Firestore fallback.
  if (conv.external_ref) {
    const { data: chatUser } = await service
      .from("chat_users")
      .select("fcm_tokens")
      .eq("tenant_id", conv.tenant_id)
      .eq("user_id", conv.external_ref)
      .maybeSingle();
    const tokens: string[] = Array.isArray(chatUser?.fcm_tokens)
      ? (chatUser.fcm_tokens as string[])
      : [];
    sendPushViaWebhook({
      userId: conv.external_ref,
      conversationId,
      bodyText: body,
      fcmToken: tokens[0],
    }).catch((err) => {
      console.warn(
        `[embed/reply] webhook push failed for ${conversationId}:`,
        err,
      );
    });
  }

  return NextResponse.json({ message });
}

async function sendPushViaWebhook(args: {
  userId: string;
  conversationId: string;
  bodyText: string;
  fcmToken?: string;
}): Promise<void> {
  const truncated =
    args.bodyText.length > 100
      ? `${args.bodyText.slice(0, 100)}…`
      : args.bodyText;
  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      message: truncated,
      title: "New message from support",
      userID: args.userId,
      eventType: "support_message",
      fcmToken: args.fcmToken ?? "no-token",
      support_ticket_id: args.conversationId,
      is_message: true,
      senderType: "admin",
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`webhook ${res.status}: ${text.slice(0, 200)}`);
  }
}
