/**
 * Server-side fan-out for chat events over Supabase Realtime.
 *
 * Architecture: after the REST API inserts a new message into Postgres,
 * we broadcast a `{ event: 'message' }` payload to a per-conversation
 * channel named `conv:<conversation_id>`. SDK clients subscribe to that
 * exact channel with the public anon key and receive the message in
 * real time — no Postgres CDC, no RLS gymnastics.
 *
 * Why broadcasts instead of postgres_changes:
 *   - Broadcasts don't require RLS on the messages table; we keep all
 *     reads going through the authenticated REST API.
 *   - Server controls exactly what's broadcast (and to which channel),
 *     so we never accidentally leak fields we'd rather strip.
 *
 * Trade-off: each broadcast does a brief subscribe/send/unsubscribe
 * round-trip — adds ~100-300ms to the message POST. Cheap enough; if
 * it becomes hot, switch to the Realtime HTTP send endpoint
 * (https://supabase.com/docs/guides/realtime/broadcast#send-via-rest).
 */

import { getServiceClient } from "@/lib/supabase/server";
import type { ConversationStatus } from "@/lib/conversation-status";

/** Broadcast a new message to subscribers of conv:<conversationId>.
 *  Fire-and-forget at the API level — if the broadcast fails we log
 *  and move on so the response still returns 200 to the SDK. */
export async function broadcastMessage(
  conversationId: string,
  message: Record<string, unknown>,
): Promise<void> {
  const service = getServiceClient();
  const channelName = `conv:${conversationId}`;
  const channel = service.channel(channelName);
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("subscribe timeout")), 4000);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timer);
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          clearTimeout(timer);
          reject(new Error(`subscribe status ${status}`));
        }
      });
    });
    await channel.send({
      type: "broadcast",
      event: "message",
      payload: { message },
    });
  } catch (err) {
    // Realtime hiccups must not break the REST insert. Log and move on.
    console.warn("[realtime] broadcast failed", {
      channel: channelName,
      error: err instanceof Error ? err.message : err,
    });
  } finally {
    // removeChannel is sync but returns a promise — await defensively
    // so we don't leak the WebSocket between requests in a hot lambda.
    try {
      await service.removeChannel(channel);
    } catch {
      /* ignore cleanup errors */
    }
  }
}

/** Broadcast a status change to subscribers of conv:<conversationId>.
 *  Same channel as messages so the ThreadView only needs one
 *  subscription. Fire-and-forget — broadcast hiccups must not break
 *  the originating action. */
export async function broadcastStatus(
  conversationId: string,
  payload: {
    previousStatus: ConversationStatus;
    newStatus: ConversationStatus;
    changedAt: string;
    changedByUserId: string | null;
    transferredToInboxId?: string;
    transferredNote?: string;
  },
): Promise<void> {
  const service = getServiceClient();
  const channelName = `conv:${conversationId}`;
  const channel = service.channel(channelName);
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("subscribe timeout")), 2000);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timer);
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          clearTimeout(timer);
          reject(new Error(`subscribe status ${status}`));
        }
      });
    });
    await channel.send({
      type: "broadcast",
      event: "status_changed",
      payload,
    });
  } catch (err) {
    console.warn("[realtime] status broadcast failed", {
      channel: channelName,
      error: err instanceof Error ? err.message : err,
    });
  } finally {
    try {
      await service.removeChannel(channel);
    } catch {
      /* ignore cleanup errors */
    }
  }
}

/** Broadcast a typing event. Same channel as messages so clients only
 *  need one subscription. Includes the sender id + display name; the
 *  receiver decides how long to show the indicator (typically clears
 *  ~3s after the last event). */
export async function broadcastTyping(
  conversationId: string,
  args: { senderId: string; senderName?: string },
): Promise<void> {
  const service = getServiceClient();
  const channelName = `conv:${conversationId}`;
  const channel = service.channel(channelName);
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("subscribe timeout")), 2000);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timer);
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          clearTimeout(timer);
          reject(new Error(`subscribe status ${status}`));
        }
      });
    });
    await channel.send({
      type: "broadcast",
      event: "typing",
      payload: { senderId: args.senderId, senderName: args.senderName ?? null, at: Date.now() },
    });
  } catch (err) {
    // Typing isn't critical — log + move on.
    console.warn("[realtime] typing broadcast failed", {
      channel: channelName,
      error: err instanceof Error ? err.message : err,
    });
  } finally {
    try {
      await service.removeChannel(channel);
    } catch {
      /* ignore cleanup errors */
    }
  }
}
