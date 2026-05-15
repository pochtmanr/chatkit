"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { MessageCircle, Send, X } from "lucide-react";

/**
 * Visitor-side support widget for the marketing site.
 *
 * Distinct from <SupportWidget>, which loads the *agent inbox* iframe.
 * That one's for tenants who want to triage their own customers'
 * threads from within their admin app. This widget is the OTHER end:
 * someone visiting our marketing site asks for help, we answer from
 * the dashboard. Concretely:
 *   - First open: collect name + email + first message, POST to
 *     /api/embed/visitor/start. The server creates a chat_users row
 *     (so the row appears in the dashboard inbox with a name, not a
 *     raw uid), a conversation, and the first message.
 *   - On success the visitor_id is persisted in localStorage. Future
 *     visits skip the form and resume the same thread.
 *   - Polls /api/embed/visitor/:id/message every 4s for agent replies.
 *     We don't subscribe to Realtime here to keep the bundle small;
 *     polling is fine at our expected volume.
 *
 * Same-origin (this is our own site), so no iframe — render the panel
 * inline. We still respect any [data-tinychat-open] button on the host
 * page so the marketing copy ("Open the widget") can deep-link into it.
 */

interface Message {
  id: string;
  sender_id: string;
  body: string | null;
  message_type: "text" | "image" | "file" | "system";
  media_url: string | null;
  created_at: string;
}

interface VisitorSession {
  visitorId: string;
  conversationId: string;
  name: string;
  email: string;
}

const STORAGE_KEY = "tinychat:visitor";
const POLL_INTERVAL_MS = 4000;

function readSession(): VisitorSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<VisitorSession>;
    if (
      !parsed.visitorId ||
      !parsed.conversationId ||
      !parsed.name ||
      !parsed.email
    ) {
      return null;
    }
    return parsed as VisitorSession;
  } catch {
    return null;
  }
}

function writeSession(s: VisitorSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function VisitorSupportWidget({ apiKey }: { apiKey: string }) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<VisitorSession | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Hydration guard — reading localStorage on first render would
  // desync the SSR HTML with the client; defer until after mount.
  useEffect(() => {
    setSession(readSession());
    setHydrated(true);
  }, []);

  // Honor [data-tinychat-open] anywhere on the host page (e.g. the
  // "Open the widget" CTA in ContactCard).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = (e.target as Element | null)?.closest(
        "[data-tinychat-open]",
      );
      if (target) setOpen(true);
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  const handleStarted = useCallback((s: VisitorSession) => {
    writeSession(s);
    setSession(s);
  }, []);

  return (
    <>
      {/* Floating action button — collapsed state. */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open support chat"
          className="fixed bottom-4 right-4 z-40 h-14 w-14 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-2xl flex items-center justify-center hover:scale-105 transition-transform"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Panel — expanded state. */}
      {open && (
        <div
          className="fixed bottom-4 right-4 z-40 w-[min(380px,calc(100vw-2rem))] h-[min(600px,calc(100vh-2rem))] bg-white rounded-2xl shadow-2xl border border-zinc-200 flex flex-col overflow-hidden"
          role="dialog"
          aria-label="Support chat"
        >
          <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 bg-white">
            <span className="text-sm font-semibold text-zinc-900">
              {session ? "We're here to help" : "Start a conversation"}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-500"
            >
              <X className="h-4 w-4" />
            </button>
          </header>
          <div className="flex-1 min-h-0 flex flex-col">
            {!hydrated ? (
              <div className="p-4 text-xs text-zinc-500">Loading…</div>
            ) : session ? (
              <ThreadView apiKey={apiKey} session={session} />
            ) : (
              <StartForm apiKey={apiKey} onStarted={handleStarted} />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function StartForm({
  apiKey,
  onStarted,
}: {
  apiKey: string;
  onStarted: (s: VisitorSession) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/embed/visitor/start", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          body: body.trim(),
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        visitor_id?: string;
        conversation_id?: string;
        error?: string;
      } | null;
      if (!res.ok || !data?.visitor_id || !data.conversation_id) {
        throw new Error(data?.error ?? `start ${res.status}`);
      }
      onStarted({
        visitorId: data.visitor_id,
        conversationId: data.conversation_id,
        name: name.trim(),
        email: email.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "send failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 p-4 overflow-y-auto"
    >
      <p className="text-xs text-zinc-500">
        Drop a quick message — we usually answer within an hour during the
        day.
      </p>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          Name
        </span>
        <input
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          Email
        </span>
        <input
          required
          type="email"
          maxLength={200}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </label>
      <label className="flex flex-col gap-1 flex-1 min-h-0">
        <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          How can we help?
        </span>
        <textarea
          required
          maxLength={4000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What's on your mind?"
          rows={4}
          className="flex-1 min-h-[96px] resize-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </label>
      {error && (
        <p className="text-xs text-red-600">Couldn&apos;t send: {error}</p>
      )}
      <button
        type="submit"
        disabled={submitting || !name.trim() || !email.trim() || !body.trim()}
        className="rounded-md bg-red-600 hover:bg-red-500 disabled:bg-zinc-300 disabled:text-zinc-500 text-white px-4 py-2 text-sm font-medium transition-colors"
      >
        {submitting ? "Sending…" : "Send"}
      </button>
    </form>
  );
}

function ThreadView({
  apiKey,
  session,
}: {
  apiKey: string;
  session: VisitorSession;
}) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const url = `/api/embed/visitor/${session.conversationId}/message?visitor_id=${encodeURIComponent(session.visitorId)}`;
      const res = await fetch(url, {
        headers: { authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? `load ${res.status}`);
      }
      const data = (await res.json()) as { messages: Message[] };
      setMessages(data.messages);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "load failed");
    }
  }, [apiKey, session.conversationId, session.visitorId]);

  // Initial load + poll. We re-fetch every POLL_INTERVAL_MS so agent
  // replies surface without a Realtime subscription.
  useEffect(() => {
    let cancelled = false;
    fetchMessages();
    const id = window.setInterval(() => {
      if (!cancelled) fetchMessages();
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [fetchMessages]);

  // Auto-scroll to bottom whenever messages change so the latest reply
  // is in view. Reads scrollHeight on the next paint so the new row is
  // measured.
  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [messages]);

  const isMine = useCallback(
    (senderId: string) => senderId === session.visitorId,
    [session.visitorId],
  );

  const onSend = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const body = draft.trim();
      if (!body || sending) return;
      setSending(true);
      // Optimistic: render immediately, reconcile on the next poll.
      const temp: Message = {
        id: `temp_${Date.now()}`,
        sender_id: session.visitorId,
        body,
        message_type: "text",
        media_url: null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => (prev ? [...prev, temp] : [temp]));
      setDraft("");
      try {
        const res = await fetch(
          `/api/embed/visitor/${session.conversationId}/message`,
          {
            method: "POST",
            headers: {
              authorization: `Bearer ${apiKey}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({ visitor_id: session.visitorId, body }),
          },
        );
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(data?.error ?? `send ${res.status}`);
        }
        // Trigger a fresh fetch so the optimistic row is replaced by the
        // server's canonical row.
        fetchMessages();
      } catch (err) {
        // Reverse the optimistic insert and surface the error.
        setMessages((prev) =>
          prev ? prev.filter((m) => m.id !== temp.id) : prev,
        );
        setError(err instanceof Error ? err.message : "send failed");
      } finally {
        setSending(false);
      }
    },
    [
      apiKey,
      draft,
      fetchMessages,
      sending,
      session.conversationId,
      session.visitorId,
    ],
  );

  const groups = useMemo(() => {
    if (!messages) return null;
    return messages.map((m) => ({ message: m, mine: isMine(m.sender_id) }));
  }, [messages, isMine]);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-3 py-3 bg-zinc-50 space-y-2"
      >
        {messages === null && (
          <div className="text-xs text-zinc-500">Loading…</div>
        )}
        {groups?.map(({ message, mine }) => (
          <div
            key={message.id}
            className={`flex ${mine ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                mine
                  ? "bg-red-600 text-white rounded-br-sm"
                  : "bg-white text-zinc-900 border border-zinc-200 rounded-bl-sm"
              }`}
            >
              {message.body || (
                <span className="italic opacity-70">[no content]</span>
              )}
            </div>
          </div>
        ))}
        {groups && groups.length === 0 && (
          <div className="text-xs text-zinc-500 text-center py-4">
            Your message is in. We&apos;ll reply here.
          </div>
        )}
      </div>
      {error && (
        <p className="px-3 py-1.5 text-[11px] text-red-600 border-t border-red-100 bg-red-50">
          {error}
        </p>
      )}
      <form
        onSubmit={onSend}
        className="flex items-end gap-2 border-t border-zinc-200 bg-white p-2"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter inserts a newline. Matches the
            // de-facto chat convention so power users don't fight the UI.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend(e as unknown as FormEvent);
            }
          }}
          placeholder="Write a reply…"
          rows={1}
          maxLength={4000}
          className="flex-1 resize-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-red-500 max-h-32"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          aria-label="Send"
          className="grid place-items-center h-9 w-9 rounded-md bg-red-600 hover:bg-red-500 disabled:bg-zinc-300 disabled:text-zinc-500 text-white transition-colors"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
