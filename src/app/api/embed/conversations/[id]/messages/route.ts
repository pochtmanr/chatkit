import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { verifyEmbedKey } from "@/lib/embed-auth";

/**
 * GET /api/embed/conversations/:id/messages
 *
 * Auth: Bearer <tenant api key>. Returns the 50 most recent messages
 * for the conversation, oldest-first (UI rendering order). Realtime
 * subscription on the client picks up newer messages as they land.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = request.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return NextResponse.json({ error: "missing bearer key" }, { status: 401 });
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
  const service = getServiceClient();
  // Scope check: conversation must belong to the JWT's tenant.
  const { data: conv } = await service
    .from("conversations")
    .select("id, external_ref")
    .eq("id", conversationId)
    .eq("tenant_id", session.tenantId)
    .maybeSingle();
  if (!conv) {
    return NextResponse.json(
      { error: "conversation not found" },
      { status: 404 },
    );
  }

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

  // Counterpart for the header.
  const { data: counterpart } = conv.external_ref
    ? await service
        .from("chat_users")
        .select("user_id, name, email")
        .eq("tenant_id", session.tenantId)
        .eq("user_id", conv.external_ref)
        .maybeSingle()
    : { data: null };

  return NextResponse.json({
    messages: (rows ?? []).slice().reverse(),
    counterpart: counterpart ?? null,
  });
}
