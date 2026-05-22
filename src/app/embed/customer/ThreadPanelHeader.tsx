"use client";

import { ArrowLeft, ExternalLink } from "lucide-react";
import type { ConversationMeta, Counterpart } from "./useThreadConversation";

// Deterministic two-letter initials + a stable colour from a hash
// of the name. Used as the visitor-facing avatar fallback when the
// assigned agent has no `avatar_url` set.
const AGENT_INITIAL_COLOURS = [
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
];
function agentInitials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const letters = parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  const palette = AGENT_INITIAL_COLOURS[Math.abs(h) % AGENT_INITIAL_COLOURS.length];
  return { letters: letters || "?", palette };
}

export function ThreadPanelHeader({
  loading,
  conversation,
  counterpart,
  conversationId,
  onBack,
}: {
  loading: boolean;
  conversation: ConversationMeta | null;
  counterpart: Counterpart | null;
  conversationId: string;
  onBack: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-200">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to inbox"
        className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-500"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      {/* While we're still loading the messages payload (which also
          carries the counterpart info) show a skeleton instead of a
          "?" + fallback name flash. */}
      {loading ? (
        <>
          <div className="h-7 w-7 rounded-full bg-zinc-100 animate-pulse shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="h-3 w-24 rounded bg-zinc-100 animate-pulse" />
          </div>
        </>
      ) : conversation?.agent ? (
        <AgentIdentity agent={conversation.agent} />
      ) : (
        <CounterpartIdentity
          counterpart={counterpart}
          conversation={conversation}
          conversationId={conversationId}
        />
      )}
    </div>
  );
}

function AgentIdentity({
  agent,
}: {
  agent: { display_name: string; avatar_url: string | null };
}) {
  const { letters, palette } = agentInitials(agent.display_name);
  return (
    <>
      {agent.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={agent.avatar_url}
          alt=""
          className="h-7 w-7 rounded-full object-cover bg-zinc-100 shrink-0"
        />
      ) : (
        <div
          className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-medium shrink-0 ${palette}`}
        >
          {letters}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate text-zinc-900">
          {agent.display_name}
        </div>
      </div>
    </>
  );
}

function CounterpartIdentity({
  counterpart,
  conversation,
  conversationId,
}: {
  counterpart: Counterpart | null;
  conversation: ConversationMeta | null;
  conversationId: string;
}) {
  const isOrder = conversation?.kind === "order" && !!conversation.external_ref;
  return (
    <>
      {counterpart?.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={counterpart.avatar_url}
          alt=""
          className="h-7 w-7 rounded-full object-cover bg-zinc-100 shrink-0"
        />
      ) : counterpart?.name || counterpart?.email ? (
        <div className="h-7 w-7 rounded-full bg-zinc-100 flex items-center justify-center text-[10px] font-medium text-zinc-500 shrink-0">
          {(counterpart.name || counterpart.email || "").slice(0, 2).toUpperCase()}
        </div>
      ) : null}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate text-zinc-900">
          {counterpart?.name ||
            counterpart?.email ||
            // For order chats, fall back to the order id (the
            // external_ref) rather than the long internal UUID.
            (isOrder
              ? `Order ${conversation!.external_ref}`
              : `Conversation #${conversationId.slice(0, 8)}`)}
        </div>
        {counterpart?.email && counterpart?.name && (
          <div className="text-[10px] text-zinc-500 truncate">
            {counterpart.email}
          </div>
        )}
        {isOrder && (counterpart?.name || counterpart?.email) && (
          <div className="text-[10px] text-zinc-500 truncate">
            Order {conversation!.external_ref}
          </div>
        )}
      </div>
      {isOrder && (
        <button
          type="button"
          onClick={() => {
            window.parent.postMessage(
              {
                type: "chat-admin:view-order",
                orderId: conversation!.external_ref,
              },
              "*",
            );
          }}
          title="View order"
          aria-label="View order"
          className="text-[10px] px-2 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-700 shrink-0"
        >
          Order
        </button>
      )}
      {counterpart?.user_id && (
        <button
          type="button"
          onClick={() => {
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
          className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-500 shrink-0"
        >
          <ExternalLink className="h-4 w-4" />
        </button>
      )}
    </>
  );
}
