import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { sendMessageToHubSpot } from "@/lib/hubspot";

/**
 * Outbound bridge: customer's Firebase Function (or any server-side
 * worker) POSTs here whenever a chat user sends a new message. We
 * forward the message into the tenant's HubSpot inbox.
 *
 * Auth: the request must include the tenant's `api_key` (the same one
 * the chat SDK uses) in the `x-tinychat-api-key` header. We never accept
 * the api_key in the URL — it would end up in access logs.
 *
 * Body shape:
 *   {
 *     conversation_id: string,
 *     message: string,
 *     from_user: { email?: string, name?: string }
 *   }
 *
 * This endpoint is idempotent on (tenant, conversation): the helper
 * library creates the HubSpot thread on first call and reuses it on
 * subsequent calls.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-tinychat-api-key");
  if (!apiKey) {
    return NextResponse.json(
      { error: "missing x-tinychat-api-key header" },
      { status: 401 },
    );
  }

  // Look up tenant by api_key. Service client because we want to
  // bypass RLS — the relay is a server-to-server endpoint, not a
  // user request, so the dashboard's RLS policies don't apply.
  const service = getServiceClient();
  const { data: tenant, error } = await service
    .from("tenants")
    .select("id, integration_type, status")
    .eq("api_key", apiKey)
    .maybeSingle();
  if (error || !tenant) {
    return NextResponse.json({ error: "invalid api key" }, { status: 401 });
  }
  if (tenant.status !== "active") {
    return NextResponse.json(
      { error: `tenant is ${tenant.status}` },
      { status: 403 },
    );
  }
  if (tenant.integration_type !== "hubspot") {
    // Tenant hasn't connected HubSpot — quietly accept the request
    // so the customer's Function doesn't retry, but no-op.
    return NextResponse.json({ skipped: "integration_not_configured" });
  }

  let payload: {
    conversation_id?: string;
    message?: string;
    from_user?: { email?: string; name?: string };
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  if (!payload.conversation_id || !payload.message) {
    return NextResponse.json(
      { error: "conversation_id and message are required" },
      { status: 400 },
    );
  }

  try {
    const { ticketId } = await sendMessageToHubSpot({
      tenantId: tenant.id,
      conversationId: payload.conversation_id,
      message: payload.message,
      fromUser: payload.from_user ?? {},
    });
    return NextResponse.json({ ok: true, hubspot_ticket_id: ticketId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
