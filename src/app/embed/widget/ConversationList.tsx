"use client";

import { useEffect, useState } from "react";

interface ConversationRow {
  id: string;
  external_ref: string | null;
  last_message: string | null;
  last_at: string | null;
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
      <div className="p-4 text-xs text-red-600 dark:text-red-400">
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
    <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 overflow-y-auto h-full">
      {rows.map((c) => {
        const u = c.external_ref ? users.get(c.external_ref) : null;
        const name = u?.name || u?.email || c.external_ref || c.id.slice(0, 8);
        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onOpen(c.id)}
              className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition"
            >
              <div className="h-9 w-9 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs font-medium text-zinc-600 dark:text-zinc-400 shrink-0">
                {name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium truncate">{name}</span>
                  {c.last_at && (
                    <span className="text-[10px] text-zinc-500 shrink-0">
                      {relativeTime(new Date(c.last_at))}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 truncate mt-0.5">
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
