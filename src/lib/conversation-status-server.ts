import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import type { ConversationStatus } from "@/lib/conversation-status";

/**
 * Flips conversation status based on the direction of a new message.
 *
 * Skipped when the conversation is already 'done' or 'transferred' — a
 * closed thread shouldn't reopen from a stray message; an agent has to
 * pick 'active' to reopen explicitly.
 *
 * Uses the service client because some call sites (the embed visitor
 * route) don't have a Supabase session — they're authed via tenant
 * API key.
 *
 * Returns `{ previous, next }` when the status actually changed; null
 * otherwise. Callers fire the webhook + broadcast themselves so they
 * can pass through the changed-by attribution.
 */
export async function updateConversationStatusFromMessage(input: {
  conversationId: string;
  direction: "inbound" | "outbound";
}): Promise<{ previous: ConversationStatus; next: ConversationStatus } | null> {
  const admin = getServiceClient();

  const { data: conv } = await admin
    .from("conversations")
    .select("id, status")
    .eq("id", input.conversationId)
    .maybeSingle();
  if (!conv) return null;
  const previous = conv.status as ConversationStatus;

  if (previous === "done" || previous === "transferred") return null;

  const next: ConversationStatus =
    input.direction === "inbound" ? "waiting_support" : "waiting_customer";
  if (next === previous) return null;

  const { error } = await admin
    .from("conversations")
    .update({ status: next, status_updated_at: new Date().toISOString() })
    .eq("id", input.conversationId);
  if (error) return null;

  return { previous, next };
}
