"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

interface ConversationRow {
  id: string;
  kind: "support" | "order";
  external_ref: string | null;
  last_message: string | null;
  last_at: string | null;
  participants: string[] | null;
}

interface ChatUserRow {
  user_id: string;
  name: string | null;
  email: string | null;
}

/**
 * Calls /api/embed/conversations server-side (RLS-bypassing) instead
 * of querying Supabase from the browser directly — the anon role
 * can't see most rows.
 */
export function ConversationList({
  apiKey,
  onOpen,
}: {
  apiKey: string;
  onOpen: (conversationId: string) => void;
}) {
  const [rows, setRows] = useState<ConversationRow[] | null>(null);
  const [users, setUsers] = useState<Map<string, ChatUserRow>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Filter rows by search term — matches against the displayed name,
  // email, and the message preview. Case-insensitive substring match.
  const filtered = useMemo(() => {
    if (!rows) return null;
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((c) => {
      const lookupKey =
        c.kind === "order"
          ? c.participants?.[0] ?? null
          : c.external_ref;
      const u = lookupKey ? users.get(lookupKey) : null;
      const haystacks = [
        u?.name,
        u?.email,
        c.last_message,
        c.external_ref,
      ]
        .filter((s): s is string => !!s)
        .map((s) => s.toLowerCase());
      return haystacks.some((s) => s.includes(q));
    });
  }, [rows, users, search]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/embed/conversations", {
          headers: { authorization: `Bearer ${apiKey}` },
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? `list ${res.status}`);
        }
        const { conversations, users: usersData } = (await res.json()) as {
          conversations: ConversationRow[];
          users: ChatUserRow[];
        };
        if (cancelled) return;
        setRows(conversations);
        const m = new Map<string, ChatUserRow>();
        usersData.forEach((u) => m.set(u.user_id, u));
        setUsers(m);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "load failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  if (error) {
    return (
      <div className="p-4 text-xs text-red-400">
        Couldn&apos;t load: {error}
      </div>
    );
  }
  if (!rows) {
    return <div className="p-4 text-xs text-zinc-500">Loading…</div>;
  }
  if (rows.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-zinc-500">
        No conversations yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-950">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations…"
            className="w-full pl-8 pr-2 py-1.5 text-xs rounded-md border border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-100"
          />
        </div>
      </div>
      {filtered && filtered.length === 0 ? (
        <div className="p-6 text-center text-xs text-zinc-500">
          No matches.
        </div>
      ) : (
        <ul className="divide-y divide-zinc-800 overflow-y-auto flex-1">
          {(filtered ?? []).map((c) => {
        // Support: name comes from chat_users keyed by external_ref.
        // Order: external_ref is the order id; customer is participants[0].
        const lookupKey =
          c.kind === "order"
            ? c.participants?.[0] ?? null
            : c.external_ref;
        const u = lookupKey ? users.get(lookupKey) : null;
        const name = u?.name || u?.email || lookupKey || c.id.slice(0, 8);
        const orderSuffix =
          c.kind === "order" && c.external_ref
            ? ` · #${c.external_ref.slice(-6).toUpperCase()}`
            : "";
        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onOpen(c.id)}
              className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-zinc-900 transition"
            >
              <div className="h-9 w-9 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-medium text-zinc-400 shrink-0">
                {name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium truncate text-zinc-100">
                    {name}
                    {orderSuffix}
                  </span>
                  {c.last_at && (
                    <span className="text-[10px] text-zinc-500 shrink-0">
                      {relativeTime(new Date(c.last_at))}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 truncate mt-0.5">
                  {c.kind === "order" && (
                    <span className="inline-block mr-1 px-1 py-0.5 rounded bg-zinc-800 text-[9px] uppercase tracking-wide">
                      Order
                    </span>
                  )}
                  {c.last_message || (
                    <span className="italic">No messages yet</span>
                  )}
                </p>
              </div>
            </button>
          </li>
        );
      })}
        </ul>
      )}
    </div>
  );
}

function relativeTime(d: Date): string {
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return d.toLocaleDateString();
}
