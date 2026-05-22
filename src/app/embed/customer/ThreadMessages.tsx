"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import type { DbMessage } from "./useThreadConversation";
import { bubbleStyles, type BubbleStyle } from "./_lib/theme";

export function ThreadMessages({
  messages,
  self,
  bubbleStyle,
  primaryColor,
  onEdit,
  onDelete,
}: {
  messages: DbMessage[] | null;
  // JWT subject — used to flag the customer's own messages so the
  // bubble alignment + edit/delete affordances appear on them.
  self: string;
  bubbleStyle: BubbleStyle;
  primaryColor: string;
  onEdit: (id: string, body: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const outboundStyle = bubbleStyles(bubbleStyle, primaryColor, "var(--hl-radius)");
  const listRef = useRef<HTMLDivElement>(null);
  const [actionMenu, setActionMenu] = useState<{ id: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  // Auto-scroll to latest.
  useEffect(() => {
    if (!listRef.current || !messages?.length) return;
    const el = listRef.current;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [messages?.length]);

  return (
    <div
      ref={listRef}
      className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 bg-white"
    >
      {!messages ? (
        <div className="text-xs text-zinc-500 p-2">Loading…</div>
      ) : messages.length === 0 ? (
        <div className="text-xs text-zinc-500 text-center p-4">
          No messages yet.
        </div>
      ) : (
        messages.map((m) => {
          const isSelf = m.sender_id === self;
          const hasImage = m.message_type === "image" && !!m.media_url;
          const isEditing = editingId === m.id;
          const isMenuOpen = actionMenu?.id === m.id;

          // Long-press detection: 500ms pointerdown without move.
          let longPressTimer: ReturnType<typeof setTimeout> | null = null;
          const onPointerDown = () => {
            if (!isSelf) return;
            longPressTimer = setTimeout(() => {
              setActionMenu({ id: m.id });
            }, 500);
          };
          const cancelLongPress = () => {
            if (longPressTimer) clearTimeout(longPressTimer);
          };

          return (
            <div
              key={m.id}
              className={`flex ${isSelf ? "justify-end" : "justify-start"} relative`}
            >
              <div
                onPointerDown={onPointerDown}
                onPointerUp={cancelLongPress}
                onPointerLeave={cancelLongPress}
                onContextMenu={(e) => {
                  if (!isSelf) return;
                  e.preventDefault();
                  setActionMenu({ id: m.id });
                }}
                style={isSelf ? outboundStyle : undefined}
                className={`max-w-[78%] text-xs break-words relative ${
                  isSelf
                    ? ""
                    : "bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-2xl rounded-bl-sm"
                } ${hasImage ? "overflow-hidden p-0" : "px-3 py-1.5 whitespace-pre-wrap"} ${
                  isSelf ? "cursor-pointer" : ""
                }`}
              >
                {isSelf && bubbleStyle === "tail" && (
                  <span
                    aria-hidden
                    className="absolute -bottom-1.5 right-2 block h-0 w-0"
                    style={{
                      borderLeft: "6px solid transparent",
                      borderRight: "6px solid transparent",
                      borderTop: `6px solid ${primaryColor}`,
                    }}
                  />
                )}
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
                      className="block max-w-full max-h-72 object-cover"
                      loading="lazy"
                    />
                  </a>
                )}
                {isEditing ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void onEdit(m.id, editText);
                      setEditingId(null);
                    }}
                    className={hasImage ? "px-3 py-1.5" : ""}
                  >
                    <input
                      autoFocus
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onBlur={() => setEditingId(null)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="w-full bg-transparent text-xs outline-none text-current"
                    />
                  </form>
                ) : (
                  m.body && (
                    <div className={hasImage ? "px-3 py-1.5" : ""}>
                      {m.body}
                    </div>
                  )
                )}
              </div>

              {/* Action menu — anchored to the right side of the bubble row. */}
              {isMenuOpen && (
                <div
                  className="absolute right-0 -top-8 z-10 bg-zinc-50 border border-zinc-300 rounded-lg shadow-lg flex items-center gap-1 p-1 text-xs text-zinc-800"
                  onMouseLeave={() => setActionMenu(null)}
                >
                  {!hasImage && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditText(m.body ?? "");
                        setEditingId(m.id);
                        setActionMenu(null);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-100"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      void onDelete(m.id);
                      setActionMenu(null);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-100 text-red-300"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
