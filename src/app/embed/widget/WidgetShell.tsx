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

export function WidgetShell({ apiKey }: { apiKey: string }) {
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

  // Listen for "open the widget" commands from the host page. Optional
  // externalRef + kind lets the host deep-link to a specific
  // conversation (e.g. "Join chat" on an order row opens that order's
  // thread directly). If lookup fails we fall back to the list view.
  useEffect(() => {
    const onMsg = async (e: MessageEvent) => {
      const data = e.data;
      if (!data || typeof data !== "object") return;
      const msg = data as {
        type?: string;
        externalRef?: string;
        kind?: "support" | "order";
        participants?: string[];
      };
      if (msg.type !== "chat-admin:open") return;

      // No external ref → just open the list.
      if (!msg.externalRef) {
        setOpenConvId(null);
        setView("list");
        return;
      }

      try {
        // find-or-create: opens the thread even if no messages have
        // been sent yet (e.g. an order with zero chat history).
        const res = await fetch("/api/embed/conversations/find", {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            external_ref: msg.externalRef,
            kind: msg.kind ?? "support",
            participants: msg.participants,
          }),
        });
        if (res.ok) {
          const { conversation } = (await res.json()) as {
            conversation: { id: string };
          };
          setOpenConvId(conversation.id);
          setView("thread");
          return;
        }
      } catch {
        // fall through to list
      }
      setOpenConvId(null);
      setView("list");
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [apiKey]);

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
    <div className="fixed inset-0 flex items-end justify-end pointer-events-none">
      {/* Panel — only when open. Fills the iframe area entirely so
          when the host resizes the iframe, the visible panel scales
          to match (no empty gutter around it). */}
      {view !== "closed" && (
        <div
          className="pointer-events-auto bg-white rounded-2xl shadow-2xl border border-zinc-200 flex flex-col overflow-hidden w-full h-full"
        >
          <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 bg-white">
            <span className="text-sm font-semibold text-zinc-900">
              {view === "thread" ? "Conversation" : "Support inbox"}
            </span>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-500"
            >
              <X className="h-4 w-4" />
            </button>
          </header>
          <div className="flex-1 min-h-0">
            {view === "list" && (
              <ConversationList
                apiKey={apiKey}
                onOpen={openThread}
              />
            )}
            {view === "thread" && openConvId && (
              <ThreadPanel
                conversationId={openConvId}
                apiKey={apiKey}
                onBack={backToList}
              />
            )}
          </div>
        </div>
      )}

      {/* FAB — only when the panel is closed. mb/mr give a visible
          inset from the viewport edge since the wrapper itself has
          no padding (open-state panel needs to fill the iframe). */}
      {view === "closed" && (
        <button
          type="button"
          onClick={openList}
          aria-label="Open support inbox"
          className="pointer-events-auto h-14 w-14 mb-3 mr-3 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-2xl flex items-center justify-center hover:scale-105 transition-transform"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
