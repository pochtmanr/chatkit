import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { verifyEmbedKey } from "@/lib/embed-auth";
import { broadcastMessage } from "@/lib/realtime";
import { fireTenantWebhook } from "@/lib/tenant-webhook";

/**
 * Visitor-side message endpoint. Pairs with /api/embed/visitor/start.
 *
 *   GET  /api/embed/visitor/:id/message?visitor_id=…
 *     Fetch the 50 most recent messages for the conversation. Used by
 *     the widget to render the thread and to poll for agent replies.
 *
 *   POST /api/embed/visitor/:id/message
 *     Body: { visitor_id, body }
 *     Sends a follow-up message as the visitor (sender_id = visitor_id,
 *     same id as conv.external_ref). Mirrors the agent /reply route but
 *     attribute the message to the visitor instead of the `agent`
 *     sentinel.
 *
 * Authorization model:
 *   - pk_live_ tenant key + Origin allowlist (same as /api/embed/*)
 *   - visitor_id must equal conversation.external_ref. This binds a
 *     visitor session to exactly one thread — without it, a leaked
 *     tenant key (which is meant to be public anyway) would expose
 *     every visitor's transcript to every other visitor on the page.
 */

async function authConversation(
  request: NextRequest,
  conversationId: string,
  visitorId: string | null,
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
  if (!visitorId) {
    return {
      err: NextResponse.json(
        { error: "visitor_id required" },
        { status: 400 },
      ),
    };
  }

  const service = getServiceClient();
  const { data: conv } = await service
    .from("conversations")
    .select("id, tenant_id, kind, external_ref")
    .eq("id", conversationId)
    .eq("tenant_id", session.tenantId)
    .eq("kind", "support")
    .maybeSingle();
  if (!conv || conv.external_ref !== visitorId) {
    // Don't leak whether the conversation exists for a different visitor.
    return {
      err: NextResponse.json(
        { error: "conversation not found" },
        { status: 404 },
      ),
    };
  }
  return { session, conv, service };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const visitorId = request.nextUrl.searchParams.get("visitor_id");
  const result = await authConversation(request, id, visitorId);
  if ("err" in result) return result.err;
  const { service, conv } = result;

  const { data: rows, error } = await service
    .from("messages")
    .select("id, sender_id, body, message_type, media_url, created_at")
    .eq("conversation_id", conv.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    messages: (rows ?? []).slice().reverse(),
    conversation_id: conv.id,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let payload: { visitor_id?: string; body?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const visitorId = (payload.visitor_id ?? "").trim() || null;
  const body = (payload.body ?? "").trim();
  if (!body) {
    return NextResponse.json({ error: "body required" }, { status: 400 });
  }
  if (body.length > 4000) {
    return NextResponse.json({ error: "body too long" }, { status: 400 });
  }

  const result = await authConversation(request, id, visitorId);
  if ("err" in result) return result.err;
  const { service, conv, session } = result;

  const { data: message, error: insErr } = await service
    .from("messages")
    .insert({
      tenant_id: conv.tenant_id,
      conversation_id: conv.id,
      sender_id: visitorId,
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
    .eq("id", conv.id);

  broadcastMessage(conv.id, message).catch((err) =>
    console.warn(`[visitor/message] broadcast failed for ${conv.id}:`, err),
  );

  fireTenantWebhook(session.tenantId, {
    conversationId: conv.id,
    senderId: visitorId!,
    body,
    mediaUrl: null,
  }).catch((err) =>
    console.warn("[visitor/message] webhook fire failed:", err),
  );

  return NextResponse.json({ message });
}
