"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, Send } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";

interface DbMessage {
  id: string;
  sender_id: string;
  body: string | null;
  created_at: string;
}

interface Counterpart {
  user_id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface ConversationMeta {
  id: string;
  kind: "support" | "order";
  external_ref: string | null;
}

/**
 * Compact thread + reply input for the widget panel.
 *
 * Loads the last 50 messages on mount; subscribes to Supabase Realtime
 * for live updates. Replies POST to /api/embed/conversations/:id/reply
 * with the tenant API key in the Authorization header — same as the
 * full-page embed route.
 */
const AGENT_SENDER_ID_PREFIX = "agent";

export function ThreadPanel({
  conversationId,
  apiKey,
  onBack,
}: {
  conversationId: string;
  apiKey: string;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<DbMessage[] | null>(null);
  const [counterpart, setCounterpart] = useState<Counterpart | null>(null);
  const [convMeta, setConvMeta] = useState<ConversationMeta | null>(null);
  const [text, setText] = useState("");
  const [isSending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Initial load via the API (server-side, RLS-bypassing).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/embed/conversations/${conversationId}/messages`,
          { headers: { authorization: `Bearer ${apiKey}` } },
        );
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? `load ${res.status}`);
        }
        const { messages: rows, counterpart: cp, conversation: meta } = (await res.json()) as {
          messages: DbMessage[];
          counterpart: Counterpart | null;
          conversation: ConversationMeta;
        };
        if (cancelled) return;
        setMessages(rows);
        setCounterpart(cp);
        setConvMeta(meta);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "load failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiKey, conversationId]);

  // Realtime subscription so new messages append without polling.
  useEffect(() => {
    const client = getBrowserClient();
    const channel = client.channel(`conv:${conversationId}`);
    channel
      .on("broadcast", { event: "message" }, ({ payload }) => {
        const m = (payload as { message?: DbMessage } | undefined)?.message;
        if (!m) return;
        setMessages((prev) => {
          if (!prev) return [m];
          if (prev.some((x) => x.id === m.id)) return prev;
          return [...prev, m];
        });
      })
      .subscribe();
    return () => {
      client.removeChannel(channel).catch(() => undefined);
    };
  }, [conversationId]);

  // Auto-scroll to latest.
  useEffect(() => {
    if (!listRef.current || !messages?.length) return;
    const el = listRef.current;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [messages?.length]);

  const send = useCallback(async () => {
    const body = text.trim();
    if (!body || isSending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/embed/conversations/${conversationId}/reply`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ body }),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `send failed (${res.status})`);
      }
      const { message } = (await res.json()) as { message: DbMessage };
      setMessages((prev) =>
        prev?.some((m) => m.id === message.id) ? prev : [...(prev ?? []), message],
      );
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "send failed");
    } finally {
      setSending(false);
    }
  }, [apiKey, conversationId, isSending, text]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to inbox"
          className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        {/* While we're still loading the messages payload (which also
            carries the counterpart info) show a skeleton instead of a
            "?" + fallback name flash. */}
        {messages === null ? (
          <>
            <div className="h-7 w-7 rounded-full bg-zinc-200 dark:bg-zinc-800 animate-pulse shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="h-3 w-24 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
            </div>
          </>
        ) : (
          <>
            {counterpart?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={counterpart.avatar_url}
                alt=""
                className="h-7 w-7 rounded-full object-cover bg-zinc-200 dark:bg-zinc-800 shrink-0"
              />
            ) : counterpart?.name || counterpart?.email ? (
              <div className="h-7 w-7 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-medium text-zinc-600 dark:text-zinc-400 shrink-0">
                {(counterpart.name || counterpart.email || "").slice(0, 2).toUpperCase()}
              </div>
            ) : null}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate text-zinc-900 dark:text-zinc-100">
                {counterpart?.name ||
                  counterpart?.email ||
                  // For order chats, fall back to the order id (the
                  // external_ref) rather than the long internal UUID.
                  (convMeta?.kind === "order" && convMeta.external_ref
                    ? `Order ${convMeta.external_ref}`
                    : `Conversation #${conversationId.slice(0, 8)}`)}
              </div>
              {counterpart?.email && counterpart?.name && (
                <div className="text-[10px] text-zinc-500 truncate">
                  {counterpart.email}
                </div>
              )}
              {convMeta?.kind === "order" && convMeta.external_ref && (counterpart?.name || counterpart?.email) && (
                <div className="text-[10px] text-zinc-500 truncate">
                  Order {convMeta.external_ref}
                </div>
              )}
            </div>
            {counterpart?.user_id && (
              <button
                type="button"
                onClick={() => {
                  // Tell the host page to navigate to this user's
                  // profile. Host decides the route (user vs driver).
                  window.parent.postMessage(
                    {
                      type: "chat-admin:view-profile",
                      userId: counterpart.user_id,
                    },
                    "*",
                  );
                }}
                title="View profile"
                aria-label="View profile"
                className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400 shrink-0"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
            )}
          </>
        )}
      </div>

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 bg-zinc-50 dark:bg-zinc-950"
      >
        {!messages ? (
          <div className="text-xs text-zinc-500 p-2">Loading…</div>
        ) : messages.length === 0 ? (
          <div className="text-xs text-zinc-500 text-center p-4">
            No messages yet.
          </div>
        ) : (
          messages.map((m) => {
            const isSelf = (m.sender_id || "").startsWith(AGENT_SENDER_ID_PREFIX);
            return (
              <div
                key={m.id}
                className={`flex ${isSelf ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[78%] rounded-2xl px-3 py-1.5 text-xs whitespace-pre-wrap break-words ${
                    isSelf
                      ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-br-sm"
                      : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-bl-sm"
                  }`}
                >
                  {m.body}
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 flex items-end gap-2"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Type a reply…"
          rows={1}
          className="flex-1 resize-none rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 max-h-20"
        />
        <button
          type="submit"
          disabled={!text.trim() || isSending}
          className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3 py-1.5 text-xs font-medium disabled:opacity-40 inline-flex items-center gap-1"
        >
          <Send className="h-3 w-3" />
          {isSending ? "…" : "Send"}
        </button>
      </form>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-[10px] px-3 py-1.5 border-t border-red-200 dark:border-red-900">
          {error}
        </div>
      )}
    </div>
  );
}
