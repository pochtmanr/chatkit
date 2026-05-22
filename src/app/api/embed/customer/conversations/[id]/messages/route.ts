import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { authCustomer, assertCustomerOwnsConversation } from "@/lib/customer-auth";
import { getAssignedAgentSummary } from "@/lib/team";

/**
 * GET /api/embed/customer/conversations/:id/messages
 *
 * Returns the 50 most recent messages in the conversation, oldest-first.
 * The caller must own the conversation (JWT.sub matches external_ref or
 * appears in participants); see assertCustomerOwnsConversation.
 *
 * Counterpart info is the agent identity (when assigned). The customer
 * already knows who they are — there's no need to round-trip their own
 * row from chat_users like the dashboard inbox does.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authCustomer(request);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const { id: conversationId } = await params;
  const ownership = await assertCustomerOwnsConversation(session, conversationId);
  if (!ownership.ok) return ownership.response;
  const conv = ownership.conversation;

  const service = getServiceClient();
  const { data: rows, error } = await service
    .from("messages")
    .select("id, sender_id, body, message_type, media_url, created_at")
    .eq("conversation_id", conv.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    return NextResponse.json({ error: "load failed" }, { status: 500 });
  }

  const agent = conv.assigned_to
    ? await getAssignedAgentSummary(conv.tenant_id, conv.assigned_to)
    : null;

  return NextResponse.json({
    messages: (rows ?? []).slice().reverse(),
    counterpart: null,
    conversation: {
      id: conv.id,
      kind: conv.kind,
      external_ref: conv.external_ref,
      agent,
    },
  });
}
