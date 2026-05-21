/**
 * Outbound webhook firing.
 *
 * When a message lands in chat-admin and the conversation's inbox has
 * a `webhook_url` set, we POST a small JSON payload to it. Tenants
 * then fan that out however they want — FCM, SMS, Slack, custom
 * logic. Fire-and-forget with a short timeout so the user's send
 * latency isn't held hostage to a slow webhook endpoint.
 *
 * Migration 0013 moved `webhook_url` from the business onto each
 * inbox, so the URL is sourced via the conversation's `inbox_id` join.
 * `tenantId` is still passed by callers (it's the business id, used
 * for cross-cutting fields like `tenant_id` in the payload and in
 * `webhook_deliveries`). Payloads also carry `inbox_id` so receivers
 * can route per-inbox going forward.
 *
 * Payload shape matches what's documented on the dashboard's webhooks
 * page; keep them in sync if you add fields.
 */

import { getServiceClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import type { ConversationStatus } from "@/lib/conversation-status";

// Generous timeout — the receiving endpoint may do Firestore lookups,
// fan-out FCM to multiple devices, and send SMTP emails to a few
// admins, all within the request. 5s was too tight; 25s leaves
// breathing room under Vercel's default 60s function ceiling.
const WEBHOOK_TIMEOUT_MS = 25000;

export interface MessageReceivedPayload {
  event: "message_received";
  /** Business id; kept under its legacy key for back-compat. */
  tenant_id: string;
  /** Inbox the message belongs to — receivers should route on this. */
  inbox_id: string;
  conversation_id: string;
  /** Conversation kind:
   *   - 'support' — admin/support 1:1 with the end-user
   *   - 'order'   — driver↔customer chat scoped to one order
   *  Tenants use this to decide whether to deep-link a push into the
   *  admin chat view or the order-chat view. */
  conversation_kind: "support" | "order";
  /** External identifier the tenant owns:
   *   - support: the end-user's user id
   *   - order:   the order id
   *  Forward this into FCM data so the mobile app can open the right
   *  thread directly when the notification is tapped. */
  external_ref: string | null;
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

export interface ConversationStatusChangedPayload {
  event: "conversation_status_changed";
  tenant_id: string;
  inbox_id: string;
  conversation_id: string;
  conversation_kind: "support" | "order";
  external_ref: string | null;
  previous_status: ConversationStatus;
  new_status: ConversationStatus;
  /** 'system' = auto-flip on inbound/outbound; 'agent' = dashboard
   *  dropdown; 'api' = future server-to-server callers. */
  changed_by: "system" | "agent" | "api";
  /** Supabase user id when `changed_by = 'agent'`, else null. */
  changed_by_user_id: string | null;
  /** Only set when transferring internally to another inbox. */
  transferred_to_inbox_id?: string;
  /** Only set when transferring (internal or external). */
  transferred_note?: string;
  changed_at: string;
}

/** Discriminated union on `event`. Webhook receivers narrow on this
 *  before reading payload fields. */
export type TenantWebhookPayload =
  | MessageReceivedPayload
  | ConversationStatusChangedPayload;

type ServiceClient = ReturnType<typeof getServiceClient>;

export type WebhookDispatchResult =
  | { ok: true; status: number; body: string }
  | { ok: false; status: number | null; body: string | null; error: string };

async function dispatchAndLog(
  service: ServiceClient,
  tenantId: string,
  webhookUrl: string,
  payload: TenantWebhookPayload,
): Promise<WebhookDispatchResult> {
  // Record the attempt in webhook_deliveries (best-effort — never let
  // logging break the actual webhook call). Migration 0012 adds the
  // table; the insert silently no-ops if it isn't applied yet.
  const { data: delivery } = await service
    .from("webhook_deliveries")
    .insert({
      tenant_id: tenantId,
      webhook_url: webhookUrl,
      event: payload.event,
      payload: payload as unknown as Json,
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
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    // Capture a snippet of the body for debugging. 2KB cap keeps the
    // row size sane if a server dumps a huge error page back.
    const text = await res.text().catch(() => "");
    const trimmed = text.slice(0, 2000);
    if (!res.ok) {
      console.warn(
        `[tenant-webhook] ${tenantId} ${webhookUrl} returned ${res.status}`,
      );
      await finish({
        status: "failed",
        response_code: res.status,
        response_body: trimmed,
        error: `HTTP ${res.status}`,
      });
      return {
        ok: false,
        status: res.status,
        body: trimmed,
        error: `HTTP ${res.status}`,
      };
    }
    await finish({
      status: "success",
      response_code: res.status,
      response_body: trimmed,
    });
    return { ok: true, status: res.status, body: trimmed };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[tenant-webhook] ${tenantId} ${webhookUrl} failed:`,
      err,
    );
    await finish({ status: "failed", error: msg });
    return { ok: false, status: null, body: null, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

/** POST to the conversation inbox's configured webhook, if any. Logs
 *  + swallows errors; never throws. */
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
  const { data: conv } = await service
    .from("conversations")
    .select(
      "id, kind, external_ref, participants, inbox_id, inboxes!inner(id, webhook_url)",
    )
    .eq("id", args.conversationId)
    .maybeSingle();
  if (!conv) return;

  // PostgREST returns the joined row as an object or an array
  // depending on cardinality declarations. Normalise.
  const inbox = Array.isArray(conv.inboxes) ? conv.inboxes[0] : conv.inboxes;
  if (!inbox?.webhook_url) return;

  let toUserId: string | null = null;
  if (conv.kind === "support") {
    toUserId = conv.external_ref ?? null;
  } else if (Array.isArray(conv.participants)) {
    toUserId = conv.participants.find((p) => p !== args.senderId) ?? null;
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
  const payload: MessageReceivedPayload = {
    event: "message_received",
    tenant_id: tenantId,
    inbox_id: inbox.id,
    conversation_id: args.conversationId,
    conversation_kind: (conv.kind as "support" | "order") ?? "support",
    external_ref: conv.external_ref ?? null,
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

  await dispatchAndLog(service, tenantId, inbox.webhook_url, payload);
}

/** Fires the `conversation_status_changed` event to the inbox's
 *  webhook URL, if any. Same delivery + logging pipeline as
 *  `fireTenantWebhook`. Safe to await or fire-and-forget. */
export async function fireConversationStatusChanged(args: {
  conversationId: string;
  previousStatus: ConversationStatus;
  newStatus: ConversationStatus;
  changedBy: "system" | "agent" | "api";
  changedByUserId: string | null;
  transferredToInboxId?: string;
  transferredNote?: string;
}): Promise<void> {
  const service = getServiceClient();

  const { data: conv } = await service
    .from("conversations")
    .select(
      "id, tenant_id, kind, external_ref, inbox_id, inboxes!inner(id, webhook_url)",
    )
    .eq("id", args.conversationId)
    .maybeSingle();
  if (!conv) return;
  const inbox = Array.isArray(conv.inboxes) ? conv.inboxes[0] : conv.inboxes;
  if (!inbox?.webhook_url) return;

  const payload: ConversationStatusChangedPayload = {
    event: "conversation_status_changed",
    tenant_id: conv.tenant_id,
    inbox_id: conv.inbox_id,
    conversation_id: conv.id,
    conversation_kind: (conv.kind as "support" | "order") ?? "support",
    external_ref: conv.external_ref ?? null,
    previous_status: args.previousStatus,
    new_status: args.newStatus,
    changed_by: args.changedBy,
    changed_by_user_id: args.changedByUserId,
    ...(args.transferredToInboxId
      ? { transferred_to_inbox_id: args.transferredToInboxId }
      : {}),
    ...(args.transferredNote ? { transferred_note: args.transferredNote } : {}),
    changed_at: new Date().toISOString(),
  };

  await dispatchAndLog(service, conv.tenant_id, inbox.webhook_url, payload);
}

/** Direct-fire variant used by the dashboard's "Send test" button.
 *  Bypasses the conversation lookup and posts a synthetic payload to
 *  the given inbox's webhook_url. No-ops if the inbox has no URL. */
export async function fireInboxTestWebhook(
  inboxId: string,
): Promise<WebhookDispatchResult> {
  const service = getServiceClient();
  const { data: inbox } = await service
    .from("inboxes")
    .select("id, business_id, webhook_url")
    .eq("id", inboxId)
    .maybeSingle();
  if (!inbox?.webhook_url) {
    return {
      ok: false,
      status: null,
      body: null,
      error: "no webhook_url configured",
    };
  }

  const payload: MessageReceivedPayload = {
    event: "message_received",
    tenant_id: inbox.business_id,
    inbox_id: inbox.id,
    conversation_id: "00000000-0000-0000-0000-000000000000",
    conversation_kind: "support",
    external_ref: null,
    direction: "inbound",
    to_user_id: null,
    fcm_tokens: [],
    to_user_email: null,
    to_user_name: null,
    sender_id: "webhook-test",
    sender_name: "ChatKit test",
    snippet: "Test payload from chat-admin webhooks page.",
  };

  return dispatchAndLog(
    service,
    inbox.business_id,
    inbox.webhook_url,
    payload,
  );
}
