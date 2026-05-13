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
  /** The recipient — for support chats this is external_ref; for order
   *  chats it's the participant on the OTHER side of the sender. */
  to_user_id: string | null;
  /** Cached FCM tokens for `to_user_id`. The tenant uses these to
   *  push, so they don't have to look up Firestore on their end. */
  fcm_tokens: string[];
  sender_id: string;
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
  if (toUserId) {
    const { data: chatUser } = await service
      .from("chat_users")
      .select("fcm_tokens")
      .eq("tenant_id", tenantId)
      .eq("user_id", toUserId)
      .maybeSingle();
    if (Array.isArray(chatUser?.fcm_tokens)) {
      fcmTokens = chatUser.fcm_tokens as string[];
    }
  }

  const snippet = (args.body ?? (args.mediaUrl ? "[image]" : "")).slice(0, 280);
  const payload: TenantWebhookPayload = {
    event: "message_received",
    tenant_id: tenantId,
    conversation_id: args.conversationId,
    to_user_id: toUserId,
    fcm_tokens: fcmTokens,
    sender_id: args.senderId,
    snippet,
    ...(args.mediaUrl ? { media_url: args.mediaUrl } : {}),
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
    if (!res.ok) {
      console.warn(
        `[tenant-webhook] ${tenant.id} ${tenant.webhook_url} returned ${res.status}`,
      );
    }
  } catch (err) {
    console.warn(
      `[tenant-webhook] ${tenant.id} ${tenant.webhook_url} failed:`,
      err,
    );
  } finally {
    clearTimeout(timer);
  }
}
