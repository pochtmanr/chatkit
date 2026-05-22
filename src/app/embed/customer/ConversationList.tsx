"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { CustomerFetch } from "./_lib/client";
import { TopicPicker, type StartOptionDTO } from "./TopicPicker";
import { NewConversationButton } from "./NewConversationButton";
import type { ButtonStyle } from "./_lib/theme";

interface ConversationRow {
  id: string;
  kind: "support" | "order" | "direct";
  external_ref: string | null;
  last_message: string | null;
  last_at: string | null;
  participants: string[] | null;
  start_option_id?: string | null;
}

/**
 * Calls /api/embed/customer/conversations server-side (RLS-bypassing,
 * scoped to the JWT subject) instead of querying Supabase from the
 * browser directly — the anon role can't see any of these rows. The
 * companion fetch grabs /api/embed/customer/start-options for the
 * picker; both are kicked off in parallel.
 */
export function ConversationList({
  fetcher,
  primaryColor = "#0F172A",
  greeting,
  buttonStyle = "solid",
  onOpen,
}: {
  fetcher: CustomerFetch;
  primaryColor?: string;
  greeting?: string | null;
  buttonStyle?: ButtonStyle;
  onOpen: (conversationId: string) => void;
}) {
  const [rows, setRows] = useState<ConversationRow[] | null>(null);
  const [options, setOptions] = useState<StartOptionDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((c) => {
      const haystacks = [c.last_message, c.external_ref]
        .filter((s): s is string => !!s)
        .map((s) => s.toLowerCase());
      return haystacks.some((s) => s.includes(q));
    });
  }, [rows, search]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [convRes, optRes] = await Promise.all([
          fetcher("/api/embed/customer/conversations"),
          fetcher("/api/embed/customer/start-options"),
        ]);
        if (!convRes.ok) {
          const data = (await convRes.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? `list ${convRes.status}`);
        }
        const { conversations } = (await convRes.json()) as {
          conversations: ConversationRow[];
        };
        if (cancelled) return;
        setRows(conversations);

        if (optRes.ok) {
          const { options: opts } = (await optRes.json()) as {
            options: StartOptionDTO[];
          };
          if (!cancelled) setOptions(opts);
        } else if (!cancelled) {
          // Picker is non-fatal: customers with no configured topics
          // still see the conversation list.
          setOptions([]);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "load failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetcher]);

  async function startConversation(optionId: string) {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetcher("/api/embed/customer/conversations/find", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ start_option_id: optionId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `start ${res.status}`);
      }
      const { conversation } = (await res.json()) as {
        conversation: { id: string };
      };
      onOpen(conversation.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not start");
    } finally {
      setCreating(false);
    }
  }

  if (error) {
    return (
      <div className="p-4 text-xs text-red-500">Couldn&apos;t load: {error}</div>
    );
  }
  if (!rows || !options) {
    return <div className="p-4 text-xs text-zinc-500">Loading…</div>;
  }

  // Empty state: render the picker directly when there are options to
  // pick — that's the panel body. With no options either, fall back to
  // the previous flat empty message so the widget still renders.
  if (rows.length === 0) {
    if (options.length === 0) {
      return (
        <div className="p-6 text-center text-xs text-zinc-500">
          No conversations yet.
        </div>
      );
    }
    return (
      <div className="flex flex-col h-full overflow-y-auto">
        <TopicPicker
          options={options}
          primaryColor={primaryColor}
          greeting={greeting}
          buttonStyle={buttonStyle}
          onPick={startConversation}
          disabled={creating}
        />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full">
      {options.length > 0 && (
        <NewConversationButton
          options={options}
          primaryColor={primaryColor}
          greeting={greeting}
          buttonStyle={buttonStyle}
          onPick={startConversation}
          disabled={creating}
        />
      )}
      <div className="px-3 py-2 border-b border-zinc-200 bg-white">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations…"
            className="w-full pl-8 pr-2 py-1.5 text-xs rounded-md border border-zinc-300 bg-zinc-50 text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          />
        </div>
      </div>
      {filtered && filtered.length === 0 ? (
        <div className="p-6 text-center text-xs text-zinc-500">No matches.</div>
      ) : (
        <ul className="divide-y divide-zinc-200 overflow-y-auto flex-1">
          {(filtered ?? []).map((c) => {
            const title =
              c.kind === "order" && c.external_ref
                ? `Order #${c.external_ref.slice(-6).toUpperCase()}`
                : titleForKind(c.kind);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onOpen(c.id)}
                  className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-zinc-100 transition"
                >
                  <div className="h-9 w-9 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-medium text-zinc-500 shrink-0">
                    {title.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium truncate text-zinc-900">
                        {title}
                      </span>
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
      )}
    </div>
  );
}

function titleForKind(kind: ConversationRow["kind"]): string {
  switch (kind) {
    case "support":
      return "Support";
    case "order":
      return "Order";
    case "direct":
      return "Direct";
  }
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
