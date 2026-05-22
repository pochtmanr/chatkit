"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { QueueRow } from "./QueueRow";
import type { LoadedQueues, QueueConversation } from "./loadQueues";

type Props = {
  data: LoadedQueues;
  managerView: boolean;
};

type TabId = "queue" | "unassigned";

function matches(row: QueueConversation, q: string): boolean {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return (
    row.displayName.toLowerCase().includes(needle) ||
    row.inboxName.toLowerCase().includes(needle) ||
    (row.lastMessage ?? "").toLowerCase().includes(needle)
  );
}

export function QueueRailContent({ data, managerView }: Props) {
  const [tab, setTab] = useState<TabId>("queue");
  const [query, setQuery] = useState("");

  const queueCount = useMemo(
    () => data.groups.reduce((acc, g) => acc + g.rows.length, 0),
    [data.groups],
  );
  const unassignedCount = data.unassigned.length;

  const filteredGroups = useMemo(
    () =>
      data.groups.map((g) => ({
        ...g,
        rows: g.rows.filter((r) => matches(r, query)),
      })),
    [data.groups, query],
  );
  const filteredUnassigned = useMemo(
    () => data.unassigned.filter((r) => matches(r, query)),
    [data.unassigned, query],
  );

  return (
    <>
      <div className="px-3 pt-3 pb-2 border-b border-mist/70 space-y-2">
        <div className="relative">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-deep/40"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search this queue…"
            className="w-full rounded-full border border-mist bg-mist/30 pl-8 pr-3 py-1.5 text-[12.5px] text-ink placeholder:text-deep/40 focus:outline-none focus:ring-2 focus:ring-ink/15"
          />
        </div>
        <div role="tablist" className="flex items-center gap-1">
          <TabButton
            id="queue"
            active={tab === "queue"}
            label={managerView ? "All assigned" : "My queue"}
            count={queueCount}
            onClick={() => setTab("queue")}
          />
          <TabButton
            id="unassigned"
            active={tab === "unassigned"}
            label="Unassigned"
            count={unassignedCount}
            onClick={() => setTab("unassigned")}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === "queue" ? (
          filteredGroups.length === 0 ||
          filteredGroups.every((g) => g.rows.length === 0) ? (
            <EmptyHint
              text={
                query
                  ? "No matches in this queue."
                  : managerView
                    ? "No conversations are assigned yet."
                    : "Nothing assigned to you yet."
              }
            />
          ) : managerView ? (
            <div className="divide-y divide-mist">
              {filteredGroups.map((g, idx) =>
                g.rows.length === 0 ? null : (
                  <div key={g.agent?.user_id ?? `g-${idx}`} className="py-1">
                    <div className="px-4 pt-2 pb-1 text-[11px] uppercase tracking-[0.1em] text-deep/50">
                      {g.agent?.display_name ?? "Unknown agent"}
                      <span className="ml-1.5 text-deep/40">
                        ({g.rows.length})
                      </span>
                    </div>
                    {g.rows.map((row) => (
                      <QueueRow
                        key={row.id}
                        id={row.id}
                        displayName={row.displayName}
                        inboxName={row.inboxName}
                        status={row.status}
                        statusUpdatedAt={row.statusUpdatedAt}
                        lastMessage={row.lastMessage}
                      />
                    ))}
                  </div>
                ),
              )}
            </div>
          ) : (
            <div className="divide-y divide-mist">
              {filteredGroups[0]?.rows.map((row) => (
                <QueueRow
                  key={row.id}
                  id={row.id}
                  displayName={row.displayName}
                  inboxName={row.inboxName}
                  status={row.status}
                  statusUpdatedAt={row.statusUpdatedAt}
                  lastMessage={row.lastMessage}
                />
              ))}
            </div>
          )
        ) : filteredUnassigned.length === 0 ? (
          <EmptyHint text={query ? "No matches." : "Queue's empty. Nice."} />
        ) : (
          <div className="divide-y divide-mist">
            {filteredUnassigned.map((row) => (
              <QueueRow
                key={row.id}
                id={row.id}
                displayName={row.displayName}
                inboxName={row.inboxName}
                status={row.status}
                statusUpdatedAt={row.statusUpdatedAt}
                lastMessage={row.lastMessage}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function TabButton({
  active,
  label,
  count,
  onClick,
  id,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
  id: string;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      aria-controls={`queue-tab-${id}`}
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${
        active
          ? "bg-ink text-white"
          : "text-deep hover:text-ink hover:bg-mist/40"
      }`}
    >
      {label}{" "}
      <span className={active ? "text-white/70" : "text-deep/50"}>
        ({count})
      </span>
    </button>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="px-4 py-6 text-[12px] text-deep/50">{text}</p>;
}
