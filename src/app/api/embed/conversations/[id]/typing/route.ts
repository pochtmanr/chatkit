import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { broadcastTyping } from "@/lib/realtime";
import { verifyEmbedKey } from "@/lib/embed-auth";

/**
 * POST /api/embed/conversations/:id/typing
 *
 * Embed-side typing signal — auth via Bearer api key + Origin/Referer
 * (same as the rest of /api/embed/*). Body { sender_id?, sender_name? };
 * sender_id defaults to "agent" since the embed widget represents an
 * admin acting from the host page.
 */
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

  let payload: { sender_id?: string; sender_name?: string };
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const { id: conversationId } = await params;
  const service = getServiceClient();
  const { data: conv } = await service
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("tenant_id", session.tenantId)
    .maybeSingle();
  if (!conv) {
    return NextResponse.json({ error: "conversation not found" }, { status: 404 });
  }

  await broadcastTyping(conversationId, {
    senderId: payload.sender_id ?? "agent",
    senderName: payload.sender_name ?? "Support",
  });
  return NextResponse.json({ ok: true });
}
