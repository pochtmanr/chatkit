/**
 * Outbound webhook firing.
 *
 * When a message lands in chat-admin and `tenants.webhook_url` is set,
 * we POST a small JSON payload to it. Tenants then fan that out
 * however they want — FCM, SMS, Slack, custom logic. Fire-and-forget
 * with a short timeout so the user's send latency isn't held hostage
 * to a slow webhook endpoint.
 *
 * Payload shape matches what's documented on the dashboard's webhooks
 * page; keep them in sync if you add fields.
 */

import { getServiceClient } from "@/lib/supabase/server";

const WEBHOOK_TIMEOUT_MS = 5000;

export interface TenantWebhookPayload {
  event: "message_received";
  tenant_id: string;
  conversation_id: string;
  /** Direction of the message:
   *   - 'inbound'  — a customer / driver sent it (the agent should see it)
   *   - 'outbound' — an agent sent it (the end-user should see it)
   *  Tenants typically route inbound → email-to-admin and outbound →
   *  push-to-end-user, but this is just a hint; do whatever makes sense
   *  in your webhook handler. */
  direction: "inbound" | "outbound";
  /** The recipient — for support chats this is external_ref; for order
   *  chats it's the participant on the OTHER side of the sender. */
  to_user_id: string | null;
  /** Cached FCM tokens for `to_user_id`. The tenant uses these to
   *  push, so they don't have to look up Firestore on their end. */
  fcm_tokens: string[];
  /** Recipient's email when known — useful for inbound→email routing. */
  to_user_email: string | null;
  /** Recipient's display name, if any. */
  to_user_name: string | null;
  sender_id: string;
  /** Sender display name when available — e.g. for the email subject. */
  sender_name: string | null;
  snippet: string;
  /** When the message carries an image. */
  media_url?: string | null;
}

/** POST to the tenant's configured webhook, if any. Logs + swallows
 *  errors; never throws. */
export async function fireTenantWebhook(
  tenantId: string,
  args: {
    conversationId: string;
    senderId: string;
    body: string | null;
    mediaUrl?: string | null;
  },
): Promise<void> {
  const service = getServiceClient();
  const { data: tenant } = await service
    .from("tenants")
    .select("id, webhook_url")
    .eq("id", tenantId)
    .maybeSingle();
  if (!tenant?.webhook_url) return;

  // Find the recipient: in a support chat external_ref names the
  // end-user. In order chats the conversation has two participants;
  // the recipient is whichever one isn't the sender. Whoever the
  // recipient is, look up their fcm_tokens so the tenant can push
  // without a side round-trip.
  const { data: conv } = await service
    .from("conversations")
    .select("id, kind, external_ref, participants")
    .eq("id", args.conversationId)
    .maybeSingle();
  let toUserId: string | null = null;
  if (conv) {
    if (conv.kind === "support") {
      toUserId = conv.external_ref ?? null;
    } else if (Array.isArray(conv.participants)) {
      toUserId = conv.participants.find((p) => p !== args.senderId) ?? null;
    }
  }
  let fcmTokens: string[] = [];
  let toEmail: string | null = null;
  let toName: string | null = null;
  if (toUserId) {
    const { data: chatUser } = await service
      .from("chat_users")
      .select("fcm_tokens, email, name")
      .eq("tenant_id", tenantId)
      .eq("user_id", toUserId)
      .maybeSingle();
    if (Array.isArray(chatUser?.fcm_tokens)) {
      fcmTokens = chatUser.fcm_tokens as string[];
    }
    toEmail = chatUser?.email ?? null;
    toName = chatUser?.name ?? null;
  }

  // Sender name (for the email subject / preview).
  let senderName: string | null = null;
  const { data: senderRow } = await service
    .from("chat_users")
    .select("name, role")
    .eq("tenant_id", tenantId)
    .eq("user_id", args.senderId)
    .maybeSingle();
  if (senderRow?.name) senderName = senderRow.name;

  // Direction: messages from agents/admins go OUT to end-users; every-
  // thing else (customer, driver) is an inbound message that an agent
  // should see. The agent sentinel `agent` and the legacy `agent-*` ids
  // are both treated as outbound.
  const senderRole = senderRow?.role ?? null;
  const isAgent =
    args.senderId === "agent" ||
    args.senderId.startsWith("agent-") ||
    senderRole === "admin" ||
    senderRole === "support";
  const direction: "inbound" | "outbound" = isAgent ? "outbound" : "inbound";

  const snippet = (args.body ?? (args.mediaUrl ? "[image]" : "")).slice(0, 280);
  const payload: TenantWebhookPayload = {
    event: "message_received",
    tenant_id: tenantId,
    conversation_id: args.conversationId,
    direction,
    to_user_id: toUserId,
    fcm_tokens: fcmTokens,
    to_user_email: toEmail,
    to_user_name: toName,
    sender_id: args.senderId,
    sender_name: senderName,
    snippet,
    ...(args.mediaUrl ? { media_url: args.mediaUrl } : {}),
  };

  // Record the attempt in webhook_deliveries (best-effort — never let
  // logging break the actual webhook call). Migration 0012 adds the
  // table; the insert silently no-ops if it isn't applied yet.
  const { data: delivery } = await service
    .from("webhook_deliveries")
    .insert({
      tenant_id: tenantId,
      webhook_url: tenant.webhook_url,
      event: payload.event,
      payload,
      status: "pending",
    })
    .select("id")
    .single();
  const deliveryId = delivery?.id ?? null;

  const finish = async (patch: {
    status: "success" | "failed";
    response_code?: number | null;
    response_body?: string | null;
    error?: string | null;
  }) => {
    if (!deliveryId) return;
    try {
      await service
        .from("webhook_deliveries")
        .update({ ...patch, completed_at: new Date().toISOString() })
        .eq("id", deliveryId);
    } catch {
      /* logging only */
    }
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  try {
    const res = await fetch(tenant.webhook_url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    // Capture a snippet of the body for debugging. 2KB cap keeps the
    // row size sane if a server dumps a huge error page back.
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      console.warn(
        `[tenant-webhook] ${tenant.id} ${tenant.webhook_url} returned ${res.status}`,
      );
      await finish({
        status: "failed",
        response_code: res.status,
        response_body: text.slice(0, 2000),
        error: `HTTP ${res.status}`,
      });
    } else {
      await finish({
        status: "success",
        response_code: res.status,
        response_body: text.slice(0, 2000),
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[tenant-webhook] ${tenant.id} ${tenant.webhook_url} failed:`,
      err,
    );
    await finish({ status: "failed", error: msg });
  } finally {
    clearTimeout(timer);
  }
}
