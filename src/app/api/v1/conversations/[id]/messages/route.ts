import { NextResponse, type NextRequest } from "next/server";
import { authTenant, corsHeaders } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase/server";
import { broadcastMessage } from "@/lib/realtime";
import { fireTenantWebhook } from "@/lib/tenant-webhook";

/**
 * Public SDK message API.
 *
 * GET  /api/v1/conversations/:id/messages?before=…&limit=…
 *   Paginated history, oldest-first.
 *
 * POST /api/v1/conversations/:id/messages
 *   Send a message. Body:
 *     {
 *       sender_id: string,
 *       body?: string,
 *       message_type?: 'text'|'image',
 *       media_url?: string,
 *       reply_to?: string,
 *       receiver_id?: string,
 *     }
 *   At least one of body / media_url is required.
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
    { messages: (data ?? []).reverse() },
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

  await service
    .from("conversations")
    .update({
      last_message: hasBody ? payload.body : `[${messageType}]`,
      last_at: message.created_at,
    })
    .eq("id", conversationId);

  await broadcastMessage(conversationId, message);

  // Fire the tenant's configured webhook (fan-out to FCM, SMS, etc).
  // Fire-and-forget — webhook failures don't block the SDK's send.
  fireTenantWebhook(tenant.id, {
    conversationId,
    senderId: payload.sender_id!,
    body: payload.body ?? null,
    mediaUrl: payload.media_url ?? null,
  }).catch((err) => console.warn("[v1/messages] webhook fire failed:", err));

  return NextResponse.json({ message }, { headers: corsHeaders });
}

export function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}
