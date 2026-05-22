"use client";

import { Loader2 } from "lucide-react";
import { ThreadComposer } from "./ThreadComposer";
import { ThreadMessages } from "./ThreadMessages";
import { ThreadPanelHeader } from "./ThreadPanelHeader";
import { useThreadConversation } from "./useThreadConversation";
import type { CustomerFetch } from "./_lib/client";
import type { WidgetTheme } from "./_lib/theme";

/**
 * Compact thread + reply input for the widget panel.
 *
 * Loads the last 50 messages on mount; subscribes to Supabase Realtime
 * for live updates. Replies POST to
 * /api/embed/customer/conversations/:id/reply with both the publishable
 * key and the customer widget JWT — see prompts/round-5/0-shared.md §2.5.
 *
 * `self` is the JWT subject. We mark messages whose sender_id matches
 * as outbound (the customer's own) for bubble alignment + edit/delete
 * affordances.
 */
export function ThreadPanel({
  conversationId,
  fetcher,
  self,
  theme,
  onBack,
}: {
  conversationId: string;
  fetcher: CustomerFetch;
  self: string;
  theme: WidgetTheme;
  onBack: () => void;
}) {
  const {
    conversation,
    counterpart,
    messages,
    error,
    isSending,
    isUploading,
    send,
    sendImage,
    editMessage,
    deleteMessage,
    typingUsers,
    fireTyping,
  } = useThreadConversation(conversationId, fetcher, self);

  return (
    <div className="flex flex-col h-full">
      <ThreadPanelHeader
        loading={messages === null}
        conversation={conversation}
        counterpart={counterpart}
        conversationId={conversationId}
        onBack={onBack}
      />

      <ThreadMessages
        messages={messages}
        self={self}
        bubbleStyle={theme.bubble_style}
        primaryColor={theme.primary_color}
        onEdit={editMessage}
        onDelete={deleteMessage}
      />

      {typingUsers.length > 0 && (
        <div className="px-3 py-1 text-[10px] italic text-zinc-500 border-t border-zinc-200 bg-white">
          {typingUsers[0].senderName || "Someone"} is typing…
        </div>
      )}

      {isUploading && (
        <div className="px-3 py-1.5 bg-zinc-50 border-t border-zinc-200 text-[10px] text-zinc-500 flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" /> Uploading image…
        </div>
      )}

      <ThreadComposer
        onSend={send}
        onSendImage={sendImage}
        onTyping={fireTyping}
        isSending={isSending}
        isUploading={isUploading}
        primaryColor={theme.primary_color}
        buttonStyle={theme.button_style}
      />

      {error && (
        <div className="bg-red-950 text-red-300 text-[10px] px-3 py-1.5 border-t border-red-900">
          {error}
        </div>
      )}
    </div>
  );
}
