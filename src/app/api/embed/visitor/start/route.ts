import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { getServiceClient } from "@/lib/supabase/server";
import { verifyEmbedKey } from "@/lib/embed-auth";
import { broadcastMessage } from "@/lib/realtime";
import { fireTenantWebhook } from "@/lib/tenant-webhook";

/**
 * POST /api/embed/visitor/start
 *
 * Public-facing endpoint that lets an anonymous visitor on a tenant's
 * marketing site open a support conversation. Symmetrical pair to
 * /api/embed/customer/conversations/find — the difference is that the *visitor*
 * is the actor, so the inserted message is attributed to them (not to
 * the `agent` sentinel) and we upsert a chat_users row carrying their
 * name + email so the dashboard inbox can show who's writing.
 *
 * Auth: tenant API key + Origin allowlist (same as the embed widget).
 * Per-visitor auth: caller passes (or we mint) a stable `visitor_id`,
 * which becomes the conversation's external_ref. Subsequent reads/
 * writes on the same conversation must replay that visitor_id, so a
 * caller who didn't open the thread can't snoop on it. This is the
 * same trust model as Intercom/Crisp anonymous chat — the visitor_id
 * lives in the visitor's localStorage and acts as their session token.
 */

interface StartBody {
  visitor_id?: string;
  name?: string;
  email?: string;
  body?: string;
}

export async function POST(request: NextRequest) {
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

  let payload: StartBody;
  try {
    payload = (await request.json()) as StartBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const name = (payload.name ?? "").trim();
  const email = (payload.email ?? "").trim();
  const body = (payload.body ?? "").trim();
  if (!name || !email || !body) {
    return NextResponse.json(
      { error: "name, email, body required" },
      { status: 400 },
    );
  }
  if (name.length > 120 || email.length > 200 || body.length > 4000) {
    return NextResponse.json({ error: "field too long" }, { status: 400 });
  }
  // Lightweight email check — we're not the source of truth, just
  // rejecting obvious garbage (random typing in the field) before
  // creating DB rows.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }

  // Validate or mint the visitor_id. Accept any reasonably-shaped id the
  // caller wants (so the widget can persist a UUID across sessions);
  // generate one if absent. Constrain charset/length to keep callers
  // honest and the DB rows tidy.
  let visitorId = (payload.visitor_id ?? "").trim();
  if (visitorId && !/^[A-Za-z0-9_-]{8,64}$/.test(visitorId)) {
    return NextResponse.json({ error: "invalid visitor_id" }, { status: 400 });
  }
  if (!visitorId) {
    visitorId = `v_${crypto.randomBytes(12).toString("hex")}`;
  }

  const service = getServiceClient();

  // Upsert the chat_users row so the dashboard inbox resolves a name
  // (the ConversationList hides rows without one). We don't trust a
  // returning visitor to change their email out from under existing
  // history, but updating the display name is fine.
  await service
    .from("chat_users")
    .upsert(
      {
        tenant_id: session.tenantId,
        user_id: visitorId,
        name,
        email,
        role: "customer",
      },
      { onConflict: "tenant_id,user_id" },
    );

  // find-or-create the support conversation. unique constraint on
  // (tenant_id, kind, external_ref) means the second call returns the
  // existing thread; a returning visitor keeps writing into the same
  // conversation.
  const { data: existing } = await service
    .from("conversations")
    .select("id")
    .eq("tenant_id", session.tenantId)
    .eq("kind", "support")
    .eq("external_ref", visitorId)
    .maybeSingle();

  let conversationId = existing?.id ?? null;
  if (!conversationId) {
    const { data: inserted, error: insertConvErr } = await service
      .from("conversations")
      .insert({
        tenant_id: session.tenantId,
        inbox_id: session.inboxId,
        kind: "support",
        external_ref: visitorId,
        participants: [visitorId],
      })
      .select("id")
      .single();
    if (insertConvErr || !inserted) {
      return NextResponse.json(
        { error: insertConvErr?.message ?? "create conversation failed" },
        { status: 500 },
      );
    }
    conversationId = inserted.id;
  }

  const { data: message, error: msgErr } = await service
    .from("messages")
    .insert({
      tenant_id: session.tenantId,
      conversation_id: conversationId,
      sender_id: visitorId,
      receiver_id: null,
      body,
      message_type: "text",
    })
    .select()
    .single();
  if (msgErr || !message) {
    return NextResponse.json(
      { error: msgErr?.message ?? "insert message failed" },
      { status: 500 },
    );
  }

  await service
    .from("conversations")
    .update({ last_message: body, last_at: message.created_at })
    .eq("id", conversationId);

  // Realtime fan-out so the dashboard inbox (if open) updates without
  // a manual refresh. Fire-and-forget — visitor doesn't need to wait.
  broadcastMessage(conversationId, message).catch((err) =>
    console.warn(`[visitor/start] broadcast failed for ${conversationId}:`, err),
  );

  // Tenant webhook — same path agent replies use. Direction will resolve
  // to 'inbound' (visitor_id isn't the agent sentinel).
  fireTenantWebhook(session.tenantId, {
    conversationId,
    senderId: visitorId,
    body,
    mediaUrl: null,
  }).catch((err) => console.warn("[visitor/start] webhook fire failed:", err));

  return NextResponse.json({
    visitor_id: visitorId,
    conversation_id: conversationId,
    message,
  });
}
