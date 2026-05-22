"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import type { CustomerFetch } from "./_lib/client";

export interface DbMessage {
  id: string;
  sender_id: string;
  body: string | null;
  created_at: string;
  message_type?: string;
  media_url?: string | null;
}

export interface Counterpart {
  user_id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export interface ConversationMeta {
  id: string;
  kind: "support" | "order" | "direct";
  external_ref: string | null;
  // Identity of the agent assigned to this conversation, joined
  // server-side from support_agents (round 4). null until an agent
  // has claimed the thread.
  agent?: { display_name: string; avatar_url: string | null } | null;
}

export interface TypingUser {
  senderId: string;
  senderName: string | null;
  at: number;
}

export interface UseThreadConversationResult {
  conversation: ConversationMeta | null;
  counterpart: Counterpart | null;
  messages: DbMessage[] | null;
  loading: boolean;
  error: string | null;
  setError: (err: string | null) => void;
  isSending: boolean;
  isUploading: boolean;
  send: (body: string) => Promise<void>;
  sendImage: (file: File) => Promise<void>;
  editMessage: (id: string, body: string) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  typingUsers: TypingUser[];
  fireTyping: () => void;
}

export function useThreadConversation(
  conversationId: string,
  fetcher: CustomerFetch,
  selfSenderId: string,
): UseThreadConversationResult {
  const [messages, setMessages] = useState<DbMessage[] | null>(null);
  const [counterpart, setCounterpart] = useState<Counterpart | null>(null);
  const [conversation, setConversation] = useState<ConversationMeta | null>(null);
  const [isSending, setSending] = useState(false);
  const [isUploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const lastTypingSentRef = useRef(0);

  // Initial load via the API (server-side, RLS-bypassing).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetcher(
          `/api/embed/customer/conversations/${conversationId}/messages`,
        );
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? `load ${res.status}`);
        }
        const { messages: rows, counterpart: cp, conversation: meta } =
          (await res.json()) as {
            messages: DbMessage[];
            counterpart: Counterpart | null;
            conversation: ConversationMeta;
          };
        if (cancelled) return;
        setMessages(rows);
        setCounterpart(cp);
        setConversation(meta);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "load failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetcher, conversationId]);

  // Realtime subscription — messages + typing events on the same
  // channel. Typing entries TTL out after ~3.5s in a separate sweep.
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
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const p = payload as {
          senderId?: string;
          senderName?: string | null;
          at?: number;
        };
        if (!p?.senderId) return;
        // Filter our own typing echo — we're the customer (claims.sub).
        if (p.senderId === selfSenderId) return;
        setTypingUsers((prev) => {
          const without = prev.filter((u) => u.senderId !== p.senderId);
          return [
            ...without,
            {
              senderId: p.senderId!,
              senderName: p.senderName ?? null,
              at: p.at ?? Date.now(),
            },
          ];
        });
      })
      .subscribe();
    const sweep = setInterval(() => {
      const cutoff = Date.now() - 3500;
      setTypingUsers((prev) => {
        const next = prev.filter((u) => u.at > cutoff);
        return next.length === prev.length ? prev : next;
      });
    }, 1000);
    return () => {
      clearInterval(sweep);
      client.removeChannel(channel).catch(() => undefined);
    };
  }, [conversationId, selfSenderId]);

  const fireTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSentRef.current < 2000) return;
    lastTypingSentRef.current = now;
    fetcher(`/api/embed/customer/conversations/${conversationId}/typing`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }).catch(() => {
      /* typing is non-critical */
    });
  }, [fetcher, conversationId]);

  const send = useCallback(
    async (body: string) => {
      const trimmed = body.trim();
      if (!trimmed || isSending) return;
      setSending(true);
      setError(null);
      try {
        const res = await fetcher(
          `/api/embed/customer/conversations/${conversationId}/reply`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ body: trimmed }),
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
      } catch (err) {
        setError(err instanceof Error ? err.message : "send failed");
      } finally {
        setSending(false);
      }
    },
    [fetcher, conversationId, isSending],
  );

  const sendImage = useCallback(
    async (file: File) => {
      if (isUploading) return;
      setUploading(true);
      setError(null);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const upRes = await fetcher(
          `/api/embed/customer/conversations/${conversationId}/upload`,
          { method: "POST", body: fd },
        );
        if (!upRes.ok) {
          const data = (await upRes.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? `upload failed (${upRes.status})`);
        }
        const { url } = (await upRes.json()) as { url: string };

        const sendRes = await fetcher(
          `/api/embed/customer/conversations/${conversationId}/reply`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ media_url: url, message_type: "image" }),
          },
        );
        if (!sendRes.ok) {
          const data = (await sendRes.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? `send failed (${sendRes.status})`);
        }
        const { message } = (await sendRes.json()) as { message: DbMessage };
        setMessages((prev) =>
          prev?.some((m) => m.id === message.id) ? prev : [...(prev ?? []), message],
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "image send failed");
      } finally {
        setUploading(false);
      }
    },
    [fetcher, conversationId, isUploading],
  );

  const editMessage = useCallback(
    async (msgId: string, body: string) => {
      const trimmed = body.trim();
      if (!trimmed) return;
      try {
        const res = await fetcher(
          `/api/embed/customer/conversations/${conversationId}/messages/${msgId}`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ body: trimmed }),
          },
        );
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? `edit failed (${res.status})`);
        }
        const { message } = (await res.json()) as { message: DbMessage };
        setMessages((prev) =>
          (prev ?? []).map((m) => (m.id === msgId ? { ...m, ...message } : m)),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "edit failed");
      }
    },
    [fetcher, conversationId],
  );

  const deleteMessage = useCallback(
    async (msgId: string) => {
      const prev = messages;
      setMessages((cur) => (cur ?? []).filter((m) => m.id !== msgId));
      try {
        const res = await fetcher(
          `/api/embed/customer/conversations/${conversationId}/messages/${msgId}`,
          { method: "DELETE" },
        );
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? `delete failed (${res.status})`);
        }
      } catch (err) {
        setMessages(prev);
        setError(err instanceof Error ? err.message : "delete failed");
      }
    },
    [fetcher, conversationId, messages],
  );

  return {
    conversation,
    counterpart,
    messages,
    loading: messages === null,
    error,
    setError,
    isSending,
    isUploading,
    send,
    sendImage,
    editMessage,
    deleteMessage,
    typingUsers,
    fireTyping,
  };
}
