/**
 * Outbound webhook firing for tenant inboxes.
 *
 * Public API surface for the lib. Internals split between:
 *   - `./sign`   — HMAC-SHA256 signature header (Stripe-style),
 *                  dual-secret rotation window.
 *   - `./deliver`— POST + log + per-inbox event filter.
 *   - `./types`  — payload shapes + event-kind enum.
 *
 * Every payload carries `event`, `tenant_id`, `inbox_id`, and
 * `occurred_at` (ISO). Receivers narrow on `event` to read the
 * remaining fields. The HMAC signature header
 * `X-Chatkit-Signature: t=<seconds>,v1=<hex>[,v1=<hex>]` is set when
 * the inbox has a `webhook_secret`; legacy inboxes without one are
 * still dispatched, unsigned, until they rotate to mint a secret.
 *
 * Migration 0024 added per-inbox `webhook_events` opt-in. Events
 * outside that list are dropped before dispatch — receivers stop
 * seeing them entirely.
 */

import { getServiceClient } from "@/lib/supabase/server";
import type { ConversationStatus } from "@/lib/conversation-status";
import {
  dispatchToInbox,
  loadInboxDispatchContext,
  type InboxDispatchContext,
} from "./deliver";
import type {
  ConversationAssignedPayload,
  ConversationCreatedPayload,
  ConversationStatusChangedPayload,
  MessageReceivedPayload,
  TenantWebhookPayload,
  WebhookDispatchResult,
} from "./types";

export type {
  ConversationAssignedPayload,
  ConversationCreatedPayload,
  ConversationStatusChangedPayload,
  MessageReceivedPayload,
  TenantWebhookPayload,
  WebhookDispatchResult,
};
export { ALL_WEBHOOK_EVENTS, isWebhookEvent } from "./types";
export type { WebhookEventKind } from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

/** POST a `message_received` event to the conversation inbox's
 *  configured webhook, if any. Swallows errors. */
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
    .select("id, kind, external_ref, participants, inbox_id")
    .eq("id", args.conversationId)
    .maybeSingle();
  if (!conv) return;
  const ctx = await loadInboxDispatchContext(conv.inbox_id);
  if (!ctx) return;

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

  let senderName: string | null = null;
  const { data: senderRow } = await service
    .from("chat_users")
    .select("name, role")
    .eq("tenant_id", tenantId)
    .eq("user_id", args.senderId)
    .maybeSingle();
  if (senderRow?.name) senderName = senderRow.name;

  // Agent sentinel ids + admin/support roles map to outbound. Anything
  // else (driver, customer, anonymous visitor) is inbound and the agent
  // is the one who should see it.
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
    inbox_id: ctx.inboxId,
    occurred_at: nowIso(),
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

  await dispatchToInbox(ctx, payload);
}

/** Fires `conversation_status_changed`. Safe to await or fire-and-forget. */
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
    .select("id, tenant_id, kind, external_ref, inbox_id")
    .eq("id", args.conversationId)
    .maybeSingle();
  if (!conv) return;
  const ctx = await loadInboxDispatchContext(conv.inbox_id);
  if (!ctx) return;

  const occurred = nowIso();
  const payload: ConversationStatusChangedPayload = {
    event: "conversation_status_changed",
    tenant_id: conv.tenant_id,
    inbox_id: conv.inbox_id,
    occurred_at: occurred,
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
    changed_at: occurred,
  };

  await dispatchToInbox(ctx, payload);
}

/** Fires `conversation_created`. Called from the visitor-start path
 *  immediately after the conversation row is inserted. */
export async function fireConversationCreated(args: {
  conversationId: string;
  visitorName?: string | null;
  visitorEmail?: string | null;
  firstMessageSnippet?: string | null;
}): Promise<void> {
  const service = getServiceClient();
  const { data: conv } = await service
    .from("conversations")
    .select("id, tenant_id, kind, external_ref, inbox_id, status")
    .eq("id", args.conversationId)
    .maybeSingle();
  if (!conv) return;
  const ctx = await loadInboxDispatchContext(conv.inbox_id);
  if (!ctx) return;

  const payload: ConversationCreatedPayload = {
    event: "conversation_created",
    tenant_id: conv.tenant_id,
    inbox_id: conv.inbox_id,
    occurred_at: nowIso(),
    conversation_id: conv.id,
    conversation_kind: (conv.kind as "support" | "order") ?? "support",
    external_ref: conv.external_ref ?? null,
    initial_status: conv.status as ConversationStatus,
    visitor_name: args.visitorName ?? null,
    visitor_email: args.visitorEmail ?? null,
    first_message_snippet: args.firstMessageSnippet ?? null,
  };

  await dispatchToInbox(ctx, payload);
}

/** Direct-fire test variant used by the dashboard's "Send test" button.
 *  Posts a synthetic message_received payload to the given inbox's
 *  webhook_url. Kept for back-compat with existing callers; new code
 *  should use `dispatchTestPayload` for event-aware testing. */
export async function fireInboxTestWebhook(
  inboxId: string,
): Promise<WebhookDispatchResult> {
  const ctx = await loadInboxDispatchContext(inboxId);
  if (!ctx) {
    return {
      ok: false,
      status: null,
      body: null,
      error: "no webhook_url configured",
      durationMs: 0,
    };
  }
  return dispatchToInbox(ctx, buildSampleMessageReceived(ctx));
}

/** Fires a synthetic payload for any subscribed event kind. Used by
 *  the per-inbox "Test fire" menu in /dashboard/webhooks. */
export async function dispatchTestPayload(
  inboxId: string,
  eventKind: TenantWebhookPayload["event"],
): Promise<WebhookDispatchResult> {
  const ctx = await loadInboxDispatchContext(inboxId);
  if (!ctx) {
    return {
      ok: false,
      status: null,
      body: null,
      error: "no webhook_url configured",
      durationMs: 0,
    };
  }
  // Temporarily widen the subscription so tests fire even when the
  // tenant has opted out — the user is *asking* for this event. We
  // still record the delivery row so the result is auditable.
  return dispatchToInbox(
    { ...ctx, subscribedEvents: [eventKind] },
    buildSamplePayload(ctx, eventKind),
  );
}

function buildSampleMessageReceived(
  ctx: InboxDispatchContext,
): MessageReceivedPayload {
  return {
    event: "message_received",
    tenant_id: ctx.tenantId,
    inbox_id: ctx.inboxId,
    occurred_at: nowIso(),
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
}

function buildSamplePayload(
  ctx: InboxDispatchContext,
  eventKind: TenantWebhookPayload["event"],
): TenantWebhookPayload {
  const sampleConvId = "00000000-0000-0000-0000-000000000000";
  const occurred_at = nowIso();
  switch (eventKind) {
    case "message_received":
      return buildSampleMessageReceived(ctx);
    case "conversation_status_changed":
      return {
        event: "conversation_status_changed",
        tenant_id: ctx.tenantId,
        inbox_id: ctx.inboxId,
        occurred_at,
        conversation_id: sampleConvId,
        conversation_kind: "support",
        external_ref: null,
        previous_status: "new" as ConversationStatus,
        new_status: "active" as ConversationStatus,
        changed_by: "agent",
        changed_by_user_id: null,
        changed_at: occurred_at,
      };
    case "conversation_created":
      return {
        event: "conversation_created",
        tenant_id: ctx.tenantId,
        inbox_id: ctx.inboxId,
        occurred_at,
        conversation_id: sampleConvId,
        conversation_kind: "support",
        external_ref: null,
        initial_status: "new" as ConversationStatus,
        visitor_name: "Test Visitor",
        visitor_email: "visitor@example.com",
        first_message_snippet: "Hi, this is a test fire from the dashboard.",
      };
    case "conversation_assigned":
      return {
        event: "conversation_assigned",
        tenant_id: ctx.tenantId,
        inbox_id: ctx.inboxId,
        occurred_at,
        conversation_id: sampleConvId,
        previous_agent_user_id: null,
        new_agent_user_id: "00000000-0000-0000-0000-000000000000",
        new_agent_display_name: "Test Agent",
        new_agent_avatar_url: null,
      };
  }
}

/** Drains pending_webhooks rows whose inbox has a configured webhook
 *  URL. Called by the cron route at /api/cron/auto-assignment-webhooks. */
export async function dispatchPendingWebhooks(batchSize = 25): Promise<{
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
}> {
  const service = getServiceClient();
  const { data: rows } = await service
    .from("pending_webhooks")
    .select("id, event_kind, inbox_id, payload, retry_count")
    .is("sent_at", null)
    .order("created_at", { ascending: true })
    .limit(batchSize);
  if (!rows || rows.length === 0) {
    return { processed: 0, sent: 0, failed: 0, skipped: 0 };
  }

  const inboxIds = Array.from(new Set(rows.map((r) => r.inbox_id)));
  const contextById = new Map<string, InboxDispatchContext | null>();
  await Promise.all(
    inboxIds.map(async (id) => {
      contextById.set(id, await loadInboxDispatchContext(id));
    }),
  );

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const now = () => new Date().toISOString();

  for (const row of rows) {
    const ctx = contextById.get(row.inbox_id) ?? null;
    if (!ctx) {
      await service
        .from("pending_webhooks")
        .update({
          sent_at: now(),
          last_error: "inbox has no webhook_url configured",
        })
        .eq("id", row.id);
      skipped++;
      continue;
    }
    const payload = row.payload as unknown as TenantWebhookPayload;
    const result = await dispatchToInbox(ctx, payload);
    if (result.ok) {
      await service
        .from("pending_webhooks")
        .update({ sent_at: now(), last_error: null })
        .eq("id", row.id);
      sent++;
    } else {
      await service
        .from("pending_webhooks")
        .update({
          retry_count: (row.retry_count ?? 0) + 1,
          last_error: result.error,
        })
        .eq("id", row.id);
      failed++;
    }
  }

  return { processed: rows.length, sent, failed, skipped };
}
