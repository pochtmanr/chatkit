import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { verifyWidgetToken, type WidgetClaims, type WidgetKind } from "@/lib/widget-token";

// Every customer surface request (/api/embed/customer/*) must carry:
//   Authorization: Bearer <widget JWT>
//   x-holylabs-pk:  <pk_live_… | pk_test_…>
// The pk identifies the inbox; the JWT identifies the user inside it.
// See prompts/round-5/0-shared.md §2.5.

export type CustomerSession = {
  inboxId: string;
  // tenant_id on conversations/messages still refers to the parent
  // business row; widget-token verification gives us businessId in
  // that role.
  tenantId: string;
  claims: WidgetClaims;
};

export type CustomerAuthResult =
  | { ok: true; session: CustomerSession }
  | { ok: false; response: NextResponse };

function unauthenticated(): NextResponse {
  // Same response shape on every failure so the browser can't tell
  // missing-pk from bad-jwt from wrong-aud.
  return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
}

export async function authCustomer(request: NextRequest): Promise<CustomerAuthResult> {
  const auth = request.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  const jwt = m?.[1]?.trim();
  const pk = request.headers.get("x-holylabs-pk")?.trim();
  if (!jwt || !pk) return { ok: false, response: unauthenticated() };

  const result = await verifyWidgetToken(jwt, pk);
  if (!result.ok) return { ok: false, response: unauthenticated() };

  return {
    ok: true,
    session: {
      inboxId: result.inboxId,
      tenantId: result.businessId,
      claims: result.claims,
    },
  };
}

export function assertAllowedKind(
  session: CustomerSession,
  kind: WidgetKind,
): { ok: true } | { ok: false; response: NextResponse } {
  if (!session.claims.allowed_kinds.includes(kind)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "kind not allowed" }, { status: 403 }),
    };
  }
  return { ok: true };
}

/** Confirm the JWT subject is either the conversation's external_ref
 *  (support kind: external_ref == host user id) or a participant. Any
 *  mismatch returns 404 so callers can't enumerate ids by probing —
 *  the brief is explicit: customers may only see their own threads. */
export async function assertCustomerOwnsConversation(
  session: CustomerSession,
  conversationId: string,
): Promise<
  | {
      ok: true;
      conversation: {
        id: string;
        kind: string;
        external_ref: string | null;
        participants: string[] | null;
        inbox_id: string;
        tenant_id: string;
        assigned_to: string | null;
      };
    }
  | { ok: false; response: NextResponse }
> {
  const svc = getServiceClient();
  const { data } = await svc
    .from("conversations")
    .select("id, kind, external_ref, participants, inbox_id, tenant_id, assigned_to")
    .eq("id", conversationId)
    .maybeSingle();
  if (!data || data.inbox_id !== session.inboxId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "not found" }, { status: 404 }),
    };
  }
  const sub = session.claims.sub;
  const participants = Array.isArray(data.participants) ? data.participants : [];
  const isOwner = data.external_ref === sub || participants.includes(sub);
  if (!isOwner) {
    return {
      ok: false,
      response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }
  return { ok: true, conversation: data };
}
