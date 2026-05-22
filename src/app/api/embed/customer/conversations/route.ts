import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { authCustomer } from "@/lib/customer-auth";

/**
 * GET /api/embed/customer/conversations
 *
 * Lists the authenticated customer's own conversations inside the
 * inbox identified by their widget JWT. NEVER returns tenant-wide
 * rows: a customer must only see threads where they are the
 * external_ref or a named participant. See
 * prompts/round-5/0-shared.md §1.
 */
export async function GET(request: NextRequest) {
  const auth = await authCustomer(request);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const sub = session.claims.sub;
  const service = getServiceClient();

  // Scope: inbox + (external_ref == sub OR participants contains sub).
  // Postgrest's `or` filter combines with the inbox `eq` via AND.
  const { data: conversations, error } = await service
    .from("conversations")
    .select(
      "id, kind, external_ref, participants, last_message, last_at, start_option_id",
    )
    .eq("inbox_id", session.inboxId)
    .or(`external_ref.eq.${sub},participants.cs.{${sub}}`)
    .order("last_at", { ascending: false, nullsFirst: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: "list failed" }, { status: 500 });
  }

  return NextResponse.json({ conversations: conversations ?? [] });
}
