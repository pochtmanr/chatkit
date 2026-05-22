import type { ConversationStatus } from "@/lib/conversation-status";

/**
 * Outbound webhook payload types.
 *
 * Every payload carries:
 *   - `event`        — discriminator
 *   - `tenant_id`    — business id (legacy field name)
 *   - `inbox_id`     — receiver-side routing key
 *   - `occurred_at`  — ISO timestamp set server-side at dispatch
 *
 * All fields above are required on every event; receivers can narrow
 * on `event` to read the per-event additions safely.
 */

export interface MessageReceivedPayload {
  event: "message_received";
  tenant_id: string;
  inbox_id: string;
  occurred_at: string;
  conversation_id: string;
  conversation_kind: "support" | "order";
  external_ref: string | null;
  direction: "inbound" | "outbound";
  to_user_id: string | null;
  fcm_tokens: string[];
  to_user_email: string | null;
  to_user_name: string | null;
  sender_id: string;
  sender_name: string | null;
  snippet: string;
  media_url?: string | null;
}

export interface ConversationStatusChangedPayload {
  event: "conversation_status_changed";
  tenant_id: string;
  inbox_id: string;
  occurred_at: string;
  conversation_id: string;
  conversation_kind: "support" | "order";
  external_ref: string | null;
  previous_status: ConversationStatus;
  new_status: ConversationStatus;
  changed_by: "system" | "agent" | "api";
  changed_by_user_id: string | null;
  transferred_to_inbox_id?: string;
  transferred_note?: string;
  /** Retained for backwards compatibility — equals `occurred_at`. */
  changed_at: string;
}

export interface ConversationCreatedPayload {
  event: "conversation_created";
  tenant_id: string;
  inbox_id: string;
  occurred_at: string;
  conversation_id: string;
  conversation_kind: "support" | "order";
  external_ref: string | null;
  initial_status: ConversationStatus;
  visitor_name: string | null;
  visitor_email: string | null;
  first_message_snippet: string | null;
}

export interface ConversationAssignedPayload {
  event: "conversation_assigned";
  tenant_id: string;
  inbox_id: string;
  occurred_at: string;
  conversation_id: string;
  previous_agent_user_id: string | null;
  new_agent_user_id: string | null;
  new_agent_display_name: string | null;
  new_agent_avatar_url: string | null;
}

export type TenantWebhookPayload =
  | MessageReceivedPayload
  | ConversationStatusChangedPayload
  | ConversationCreatedPayload
  | ConversationAssignedPayload;

export type WebhookEventKind = TenantWebhookPayload["event"];

export const ALL_WEBHOOK_EVENTS: readonly WebhookEventKind[] = [
  "message_received",
  "conversation_status_changed",
  "conversation_assigned",
  "conversation_created",
] as const;

export function isWebhookEvent(input: string): input is WebhookEventKind {
  return (ALL_WEBHOOK_EVENTS as readonly string[]).includes(input);
}

export type WebhookDispatchResult =
  | { ok: true; status: number; body: string; durationMs: number }
  | {
      ok: false;
      status: number | null;
      body: string | null;
      error: string;
      durationMs: number;
    };
