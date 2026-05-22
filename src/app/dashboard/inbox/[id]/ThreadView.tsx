"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Paperclip, Send } from "lucide-react";
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
}: ThreadViewProps) {
  const router = useRouter();
  const endpoint = `/api/dashboard/conversations/${conversationId}/reply`;
  const [messages, setMessages] = useState<DbMessage[]>(initialMessages);
  const [text, setText] = useState("");
  const [isSending, setSending] = useState(false);
  const [isUploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      .on("broadcast", { event: "status_changed" }, () => {
        // Server fetches the header (status pill + transferred note) so
        // refreshing the route picks up the new state without re-mounting
        // the message list.
        router.refresh();
      })
      .subscribe();
    return () => {
      client.removeChannel(channel).catch(() => undefined);
    };
  }, [conversationId, router]);

  const sendReply = useCallback(async () => {
    const body = text.trim();
    if (!body || isSending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
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
  }, [endpoint, isSending, text]);

  const sendImage = useCallback(
    async (file: File) => {
      if (isUploading) return;
      setUploading(true);
      setError(null);
      try {
        const uploadEndpoint = `/api/dashboard/conversations/${conversationId}/upload`;
        const fd = new FormData();
        fd.append("file", file);
        const upRes = await fetch(uploadEndpoint, {
          method: "POST",
          body: fd,
        });
        if (!upRes.ok) {
          const data = (await upRes.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? `upload ${upRes.status}`);
        }
        const { url } = (await upRes.json()) as { url: string };

        const sendRes = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            media_url: url,
            message_type: "image",
          }),
        });
        if (!sendRes.ok) {
          const data = (await sendRes.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? `send ${sendRes.status}`);
        }
        const { message } = (await sendRes.json()) as { message: DbMessage };
        setMessages((prev) =>
          prev.some((m) => m.id === message.id) ? prev : [...prev, message],
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "image send failed");
      } finally {
        setUploading(false);
      }
    },
    [conversationId, endpoint, isUploading],
  );

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void sendImage(f);
    e.target.value = "";
  };

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
            const hasImage = m.message_type === "image" && !!m.media_url;
            return (
              <div
                key={m.id}
                className={`flex ${isSelf ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl text-sm break-words ${
                    isSelf
                      ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-br-sm"
                      : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-bl-sm"
                  } ${hasImage ? "overflow-hidden p-0" : "px-4 py-2 whitespace-pre-wrap"}`}
                >
                  {hasImage && (
                    <a
                      href={m.media_url ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="block"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.media_url!}
                        alt="attachment"
                        className="block max-w-full max-h-96 object-cover"
                        loading="lazy"
                      />
                    </a>
                  )}
                  {m.body && (
                    <div className={hasImage ? "px-4 py-2" : ""}>{m.body}</div>
                  )}
                  <div
                    className={`text-[10px] ${hasImage ? "px-4 pb-2" : "mt-1"} ${
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

      {isUploading && (
        <div className="px-4 py-1.5 bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" /> Uploading image…
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendReply();
        }}
        className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 flex items-end gap-2"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onPickFile}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isSending || isUploading}
          aria-label="Attach image"
          title="Attach image"
          className="p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400 disabled:opacity-40"
        >
          <Paperclip className="h-4 w-4" />
        </button>
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
