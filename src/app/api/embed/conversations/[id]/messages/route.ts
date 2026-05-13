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
    .select("id, kind, external_ref, participants")
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

  // Counterpart for the header. For support chats it's the end-user
  // (external_ref). For order chats it's the customer (participants[0]
  // by convention). avatar_url is optional (column added in migration
  // 0010) — gracefully handle databases where the migration hasn't
  // been applied yet.
  const lookupKey =
    conv.kind === "order"
      ? (Array.isArray(conv.participants) ? conv.participants[0] : null) ?? null
      : conv.external_ref;
  let counterpart: { user_id: string; name: string | null; email: string | null; avatar_url: string | null } | null = null;
  if (lookupKey) {
    try {
      const { data } = await service
        .from("chat_users")
        .select("user_id, name, email, avatar_url")
        .eq("tenant_id", session.tenantId)
        .eq("user_id", lookupKey)
        .maybeSingle();
      counterpart = data ?? null;
    } catch {
      const { data } = await service
        .from("chat_users")
        .select("user_id, name, email")
        .eq("tenant_id", session.tenantId)
        .eq("user_id", lookupKey)
        .maybeSingle();
      counterpart = data
        ? { ...data, avatar_url: null }
        : null;
    }
  }

  return NextResponse.json({
    messages: (rows ?? []).slice().reverse(),
    counterpart: counterpart ?? null,
    conversation: {
      id: conv.id,
      kind: conv.kind,
      external_ref: conv.external_ref,
    },
  });
}
