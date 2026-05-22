import { NextResponse, type NextRequest } from "next/server";
import { broadcastTyping } from "@/lib/realtime";
import { authCustomer, assertCustomerOwnsConversation } from "@/lib/customer-auth";

/**
 * POST /api/embed/customer/conversations/:id/typing
 *
 * Broadcasts a typing indicator on the conversation channel. sender_id
 * is always claims.sub — body-supplied identity is ignored so a leaked
 * pk can't spoof typing as another user. The display name comes from
 * the JWT claims when present; otherwise falls back to "Customer".
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

  const senderName =
    session.claims.name?.trim() ||
    session.claims.email?.trim() ||
    "Customer";

  await broadcastTyping(conversationId, {
    senderId: session.claims.sub,
    senderName,
  });
  return NextResponse.json({ ok: true });
}
