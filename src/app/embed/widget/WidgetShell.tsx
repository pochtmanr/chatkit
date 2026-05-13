"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { ConversationList } from "./ConversationList";
import { ThreadPanel } from "./ThreadPanel";

/**
 * Toggling FAB + chat panel.
 *
 * State machine:
 *   "closed"  → only the FAB visible, host iframe collapsed to FAB size
 *   "list"    → panel open, showing the list of conversations
 *   "thread"  → panel open, showing one conversation's messages
 *
 * Each state transition posts a `chat-admin:widget` message so the
 * host iframe can resize/animate to match.
 *
 * The body background is transparent so when the iframe is collapsed
 * to FAB size, only the FAB shows — the rest of the iframe area
 * doesn't get a white box.
 */
type View = "closed" | "list" | "thread";

export function WidgetShell({
  apiKey,
  tenantId,
}: {
  apiKey: string;
  tenantId: string;
}) {
  const [view, setView] = useState<View>("closed");
  const [openConvId, setOpenConvId] = useState<string | null>(null);

  // Bridge state changes to the host so it can resize the iframe.
  // Sending '*' as targetOrigin is necessary because the iframe doesn't
  // know its host's origin ahead of time; the host filters by message
  // shape on its side.
  const post = useCallback((open: boolean) => {
    if (typeof window === "undefined") return;
    window.parent.postMessage({ type: "chat-admin:widget", open }, "*");
  }, []);

  useEffect(() => {
    post(view !== "closed");
  }, [view, post]);

  const openList = () => {
    setOpenConvId(null);
    setView("list");
  };
  const close = () => setView("closed");
  const openThread = (id: string) => {
    setOpenConvId(id);
    setView("thread");
  };
  const backToList = () => {
    setOpenConvId(null);
    setView("list");
  };

  return (
    <div className="fixed inset-0 flex items-end justify-end p-4 pointer-events-none">
      {/* Panel — only when open. pointer-events: auto so clicks register
          inside the panel. Background opaque so it doesn't bleed through. */}
      {view !== "closed" && (
        <div
          className="pointer-events-auto bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden mb-3"
          style={{ width: 360, height: 540 }}
        >
          <header className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 bg-white dark:bg-zinc-950">
            <span className="text-sm font-semibold">
              {view === "thread" ? "Conversation" : "Support inbox"}
            </span>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400"
            >
              <X className="h-4 w-4" />
            </button>
          </header>
          <div className="flex-1 min-h-0">
            {view === "list" && (
              <ConversationList
                tenantId={tenantId}
                onOpen={openThread}
              />
            )}
            {view === "thread" && openConvId && (
              <ThreadPanel
                tenantId={tenantId}
                conversationId={openConvId}
                apiKey={apiKey}
                onBack={backToList}
              />
            )}
          </div>
        </div>
      )}

      {/* FAB — always rendered. */}
      <button
        type="button"
        onClick={view === "closed" ? openList : close}
        aria-label={view === "closed" ? "Open support inbox" : "Close support inbox"}
        className="pointer-events-auto h-14 w-14 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-2xl flex items-center justify-center hover:scale-105 transition-transform"
      >
        {view === "closed" ? (
          <MessageCircle className="h-6 w-6" />
        ) : (
          <X className="h-6 w-6" />
        )}
      </button>
    </div>
  );
}
