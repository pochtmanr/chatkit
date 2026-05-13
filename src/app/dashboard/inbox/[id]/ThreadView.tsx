"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";

interface DbMessage {
  id: string;
  sender_id: string;
  body: string | null;
  message_type: string;
  media_url: string | null;
  created_at: string;
}

interface ThreadViewProps {
  conversationId: string;
  /** Supabase user id of the signed-in agent. Used to decide which
   *  bubble side a message renders on. Agent-sent messages have
   *  sender_id = "agent-<currentUserId>"; we check the prefix + id. */
  currentUserId: string;
  initialMessages: DbMessage[];
  /** Endpoint to POST replies to. Defaults to the dashboard's session-
   *  authed reply route. Embed mode overrides to the JWT-authed
   *  endpoint and supplies a bearer token. */
  replyEndpoint?: string;
  /** Optional bearer token sent in the Authorization header on every
   *  reply POST. Embed mode uses this. */
  replyAuthToken?: string;
}

const AGENT_SENDER_ID_PREFIX = "agent-";

/** Live message list + reply box.
 *
 *  - Server hands us the initial 50 messages.
 *  - We subscribe to Supabase Realtime on `conv:<id>` for new messages
 *    (both customer-sent and admin-sent — admin's own send echoes back
 *    via realtime; we de-dup by id).
 *  - Reply POSTs to /api/dashboard/conversations/[id]/reply, which
 *    inserts into Supabase and triggers the broadcast.
 */
export function ThreadView({
  conversationId,
  currentUserId,
  initialMessages,
  replyEndpoint,
  replyAuthToken,
}: ThreadViewProps) {
  const endpoint =
    replyEndpoint ?? `/api/dashboard/conversations/${conversationId}/reply`;
  const [messages, setMessages] = useState<DbMessage[]>(initialMessages);
  const [text, setText] = useState("");
  const [isSending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages. Uses requestAnimationFrame so
  // the scroll fires after the new bubble has been laid out.
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [messages.length]);

  // Realtime: subscribe to the broadcast channel used by the server's
  // broadcastMessage helper. The chat-admin backend publishes to
  // `conv:<conversation_id>` with event 'message' whenever a new row
  // lands in the messages table.
  useEffect(() => {
    const client = getBrowserClient();
    const channel = client.channel(`conv:${conversationId}`);
    channel
      .on("broadcast", { event: "message" }, ({ payload }) => {
        const incoming = (payload as { message?: DbMessage } | undefined)
          ?.message;
        if (!incoming) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === incoming.id)) return prev;
          return [...prev, incoming];
        });
      })
      .subscribe();
    return () => {
      client.removeChannel(channel).catch(() => undefined);
    };
  }, [conversationId]);

  const sendReply = useCallback(async () => {
    const body = text.trim();
    if (!body || isSending) return;
    setSending(true);
    setError(null);
    try {
      const headers: Record<string, string> = {
        "content-type": "application/json",
      };
      if (replyAuthToken) {
        headers.authorization = `Bearer ${replyAuthToken}`;
      }
      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({ body }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `send failed (${res.status})`);
      }
      const { message } = (await res.json()) as { message: DbMessage };
      setMessages((prev) =>
        prev.some((m) => m.id === message.id) ? prev : [...prev, message],
      );
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "send failed");
    } finally {
      setSending(false);
    }
  }, [endpoint, isSending, replyAuthToken, text]);

  return (
    <>
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-6 py-4 space-y-2 bg-zinc-50 dark:bg-zinc-950"
      >
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-zinc-500">
            No messages yet. Be the first to say hi.
          </div>
        ) : (
          messages.map((m) => {
            const isSelf =
              m.sender_id === `${AGENT_SENDER_ID_PREFIX}${currentUserId}` ||
              m.sender_id.startsWith(AGENT_SENDER_ID_PREFIX);
            const ts = new Date(m.created_at);
            return (
              <div
                key={m.id}
                className={`flex ${isSelf ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap break-words ${
                    isSelf
                      ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-br-sm"
                      : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-bl-sm"
                  }`}
                >
                  {m.body}
                  <div
                    className={`text-[10px] mt-1 ${
                      isSelf
                        ? "text-zinc-300 dark:text-zinc-600"
                        : "text-zinc-400"
                    }`}
                  >
                    {ts.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendReply();
        }}
        className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 flex items-end gap-2"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter inserts a newline. Standard chat UX.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void sendReply();
            }
          }}
          placeholder="Type a reply…"
          rows={1}
          className="flex-1 resize-none rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 max-h-32"
        />
        <button
          type="submit"
          disabled={!text.trim() || isSending}
          className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium disabled:opacity-40 inline-flex items-center gap-1.5"
        >
          <Send className="h-3.5 w-3.5" />
          {isSending ? "Sending…" : "Send"}
        </button>
      </form>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-xs px-4 py-2 border-t border-red-200 dark:border-red-900">
          {error}
        </div>
      )}
    </>
  );
}
