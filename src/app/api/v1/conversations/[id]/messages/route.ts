import { NextResponse, type NextRequest } from "next/server";
import { authTenant, corsHeaders } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase/server";
import { sendMessageToHubSpot } from "@/lib/hubspot";
import { broadcastMessage } from "@/lib/realtime";

/**
 * GET /api/v1/conversations/:id/messages?before=…&limit=…
 *   Paginated. Returns messages newest-first; pass `before` (an ISO
 *   timestamp) to fetch the next page going backwards in time.
 *
 * POST /api/v1/conversations/:id/messages
 *   Body:
 *     {
 *       sender_id: string,           // user_id of the sender
 *       body: string,                // plain text
 *       message_type?: 'text'|'image'|'file'|'system',
 *       media_url?: string,          // when type ≠ text
 *       reply_to?: string,           // message id being replied to
 *       receiver_id?: string,        // optional explicit recipient
 *     }
 *   Inserts the message, updates the conversation's last_message/last_at,
 *   and — when integration_type=hubspot — fires the HubSpot bridge so
 *   the message appears in the tenant's HubSpot ticket. The HubSpot
 *   call runs synchronously: callers see a 502 if HubSpot is down.
 *   When that becomes a problem we move it to a queue.
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authTenant(request);
  if ("error" in auth) return auth.error;
  const tenant = auth.tenant;

  const { id: conversationId } = await params;
  const url = request.nextUrl;
  const before = url.searchParams.get("before");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

  const service = getServiceClient();

  // Sanity check: confirm the conversation belongs to this tenant
  // before returning any messages from it.
  const { data: conv } = await service
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  if (!conv) {
    return NextResponse.json(
      { error: "conversation not found" },
      { status: 404, headers: corsHeaders },
    );
  }

  let query = service
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (before) query = query.lt("created_at", before);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders },
    );
  }
  return NextResponse.json(
    { messages: (data ?? []).reverse() }, // return oldest-first to caller
    { headers: corsHeaders },
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authTenant(request);
  if ("error" in auth) return auth.error;
  const tenant = auth.tenant;

  const { id: conversationId } = await params;

  let payload: {
    sender_id?: string;
    body?: string;
    message_type?: "text" | "image" | "file" | "system";
    media_url?: string;
    reply_to?: string;
    receiver_id?: string;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400, headers: corsHeaders });
  }
  if (!payload.sender_id) {
    return NextResponse.json(
      { error: "sender_id is required" },
      { status: 400, headers: corsHeaders },
    );
  }
  const messageType = payload.message_type ?? "text";
  const hasBody = typeof payload.body === "string" && payload.body.trim().length > 0;
  const hasMedia = !!payload.media_url;
  if (messageType === "text" && !hasBody) {
    return NextResponse.json(
      { error: "body is required for text messages" },
      { status: 400, headers: corsHeaders },
    );
  }
  if (messageType !== "text" && !hasMedia) {
    return NextResponse.json(
      { error: "media_url is required for non-text messages" },
      { status: 400, headers: corsHeaders },
    );
  }

  const service = getServiceClient();

  // Conversation must belong to this tenant — guards against forging
  // an arbitrary uuid in the URL.
  const { data: conv } = await service
    .from("conversations")
    .select("id, kind, external_ref")
    .eq("id", conversationId)
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  if (!conv) {
    return NextResponse.json(
      { error: "conversation not found" },
      { status: 404, headers: corsHeaders },
    );
  }

  // Look up the sender's profile so HubSpot gets a real email/name on
  // ticket creation. Failing here doesn't block the message — we just
  // forward "anonymous" to HubSpot.
  const { data: senderProfile } = await service
    .from("chat_users")
    .select("email, name, role")
    .eq("tenant_id", tenant.id)
    .eq("user_id", payload.sender_id)
    .maybeSingle();

  const { data: message, error: msgErr } = await service
    .from("messages")
    .insert({
      tenant_id: tenant.id,
      conversation_id: conversationId,
      sender_id: payload.sender_id,
      receiver_id: payload.receiver_id ?? null,
      body: payload.body ?? null,
      message_type: messageType,
      media_url: payload.media_url ?? null,
      reply_to: payload.reply_to ?? null,
    })
    .select()
    .single();
  if (msgErr || !message) {
    return NextResponse.json(
      { error: msgErr?.message ?? "insert failed" },
      { status: 500, headers: corsHeaders },
    );
  }

  // Cache last-message preview on the conversation so listing endpoints
  // don't have to join messages every time.
  await service
    .from("conversations")
    .update({
      last_message: hasBody ? payload.body : `[${messageType}]`,
      last_at: message.created_at,
    })
    .eq("id", conversationId);

  // Fan out via Realtime so any subscribed SDK clients (other
  // participants on this conversation) receive the new message
  // immediately. Awaited because we'd rather pay the ~200ms now than
  // have the message land in Postgres but not reach the recipient.
  await broadcastMessage(conversationId, message);

  // HubSpot bridge — only for support conversations from non-admin
  // senders. Order chats are peer-to-peer and don't belong in tickets;
  // admin replies live in HubSpot already and would re-enter via the
  // inbound webhook (Phase 5), creating a loop.
  const shouldBridge =
    tenant.integration_type === "hubspot" &&
    conv.kind === "support" &&
    senderProfile?.role !== "admin" &&
    senderProfile?.role !== "support" &&
    hasBody;

  if (shouldBridge) {
    try {
      await sendMessageToHubSpot({
        tenantId: tenant.id,
        conversationId,
        message: payload.body!,
        fromUser: {
          email: senderProfile?.email ?? undefined,
          name: senderProfile?.name ?? undefined,
        },
      });
    } catch (err) {
      // Don't fail the message insert if HubSpot is down — log it on
      // the response so the SDK can surface a soft warning, but the
      // message is in our DB and will still flow via realtime.
      const reason = err instanceof Error ? err.message : "unknown";
      return NextResponse.json(
        { message, hubspot_error: reason },
        { headers: corsHeaders },
      );
    }
  }

  return NextResponse.json({ message }, { headers: corsHeaders });
}

export function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}
