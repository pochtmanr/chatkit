import { NextResponse, type NextRequest } from "next/server";
import { authTenant, corsHeaders } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase/server";
import { broadcastTyping } from "@/lib/realtime";

/**
 * POST /api/v1/conversations/:id/typing
 *
 * SDK-facing typing signal. Body: { sender_id, sender_name? }.
 * Fire-and-forget — broadcasts a `typing` event to the conversation
 * channel. The caller is expected to throttle these on its end (we
 * recommend one event per 2-3s while text changes).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authTenant(request);
  if ("error" in auth) return auth.error;
  const tenant = auth.tenant;

  let payload: { sender_id?: string; sender_name?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid json" },
      { status: 400, headers: corsHeaders },
    );
  }
  if (!payload.sender_id) {
    return NextResponse.json(
      { error: "sender_id required" },
      { status: 400, headers: corsHeaders },
    );
  }

  const { id: conversationId } = await params;
  // Ownership check: cheap single-row lookup so we don't broadcast to
  // a conversation the caller's tenant doesn't own.
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

  await broadcastTyping(conversationId, {
    senderId: payload.sender_id,
    senderName: payload.sender_name,
  });
  return NextResponse.json({ ok: true }, { headers: corsHeaders });
}

export function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}
