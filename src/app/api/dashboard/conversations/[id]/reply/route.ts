import { NextResponse, type NextRequest } from "next/server";
import { getServerClient, getServiceClient } from "@/lib/supabase/server";
import { broadcastMessage } from "@/lib/realtime";

/**
 * Admin reply endpoint.
 *
 * Authenticated by the Supabase user session (not tenant API key), so
 * agents can reply through the dashboard without exposing the tenant
 * key in the browser.
 *
 * Inserts the message into Supabase with `sender_id = "agent-<user.id>"`
 * — the prefix gives the SDK an unambiguous signal that the message is
 * from an agent (vs the customer) without having to look up roles.
 *
 * Triggers Supabase Realtime broadcast on `conv:<id>` so any mobile
 * client subscribed (or any other open dashboard tab) sees the new
 * message immediately.
 */
const AGENT_SENDER_ID_PREFIX = "agent-";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
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

  // Confirm the conversation belongs to a tenant this user owns.
  // Using the service client because RLS on conversations doesn't
  // express ownership chains. We enforce manually here.
  const service = getServiceClient();
  const { data: conv } = await service
    .from("conversations")
    .select("id, tenant_id, external_ref, tenants!inner(owner_user_id)")
    .eq("id", conversationId)
    .maybeSingle();
  type OwnerRow = {
    tenant_id: string;
    external_ref: string | null;
    tenants: { owner_user_id: string };
  };
  const owner = (conv as unknown as OwnerRow | null)?.tenants?.owner_user_id;
  if (!conv || owner !== user.id) {
    return NextResponse.json({ error: "conversation not found" }, { status: 404 });
  }

  const senderId = `${AGENT_SENDER_ID_PREFIX}${user.id}`;

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

  // Fan out via realtime so the mobile SDK on the customer's phone
  // picks up the message on its next poll or via the realtime channel
  // (depending on SDK version).
  try {
    await broadcastMessage(conversationId, message);
  } catch (err) {
    console.warn(
      `[dashboard/reply] broadcast failed for ${conversationId}:`,
      err,
    );
  }

  // Fire FCM push to the customer via the GoDelivery webhook service.
  // We read the FCM token from chat_users (populated by the SDK on
  // setCurrentUser) and pass it directly so the webhook doesn't have
  // to fall back to a Firestore lookup. external_ref is the customer's
  // Firebase UID = our chat_users.user_id.
  // Fire-and-forget — push failures shouldn't block the admin's reply.
  const externalRef = (conv as unknown as OwnerRow).external_ref;
  if (externalRef) {
    const { data: chatUser } = await service
      .from("chat_users")
      .select("fcm_tokens, email, name")
      .eq("tenant_id", conv.tenant_id)
      .eq("user_id", externalRef)
      .maybeSingle();
    const tokens: string[] = Array.isArray(chatUser?.fcm_tokens)
      ? (chatUser.fcm_tokens as string[])
      : [];
    sendPushViaWebhook({
      userId: externalRef,
      conversationId,
      bodyText: body,
      fcmToken: tokens[0],
    }).catch((err) => {
      console.warn(
        `[dashboard/reply] webhook push failed for ${conversationId}:`,
        err,
      );
    });
  }

  return NextResponse.json({ message });
}

const WEBHOOK_URL = "https://www.isrshipping.com/api/webhook-notification";

/** POST to the GoDelivery push-notification webhook. Mirrors the shape
 *  used by the mobile app (`sendSupportMessageWebhook` in
 *  Delivery-Expo/src/utils/webhook.ts) so the receiving service routes
 *  it to the correct FCM channel. */
async function sendPushViaWebhook(args: {
  userId: string;
  conversationId: string;
  bodyText: string;
  fcmToken?: string;
}): Promise<void> {
  const truncated =
    args.bodyText.length > 100 ? `${args.bodyText.slice(0, 100)}…` : args.bodyText;
  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      message: truncated,
      title: "New message from support",
      userID: args.userId,
      eventType: "support_message",
      // Pass the real FCM token if we have one. The webhook still falls
      // back to a Firestore lookup if we send "no-token", but that's
      // for callers without chat-admin's chat_users view of the world.
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
