/**
 * Conversation lifecycle enum + presentation helpers. Safe to import
 * from client components — no server-only deps. The server-side
 * auto-flip helper lives in `./conversation-status-server.ts` to keep
 * `next/headers` out of the client bundle.
 *
 * Mirrors the `conversations.status` CHECK constraint in migration 0016.
 */

export const CONVERSATION_STATUSES = [
  "new",
  "active",
  "waiting_customer",
  "waiting_support",
  "done",
  "transferred",
] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export const STATUS_LABELS: Record<ConversationStatus, string> = {
  new: "New",
  active: "Active",
  waiting_customer: "Waiting on customer",
  waiting_support: "Waiting on us",
  done: "Done",
  transferred: "Transferred",
};

/** Tailwind classes for the status pill. Muted on purpose — pills sit
 *  on a busy row and shouldn't shout. */
export const STATUS_PILL_CLASSES: Record<ConversationStatus, string> = {
  new: "bg-deep/10 text-deep border border-deep/20",
  active: "bg-emerald-50 text-emerald-800 border border-emerald-200",
  waiting_customer: "bg-amber-50 text-amber-800 border border-amber-200",
  waiting_support: "bg-rose-50 text-rose-800 border border-rose-200",
  done: "bg-mist text-deep/60 border border-mist",
  transferred: "bg-indigo-50 text-indigo-800 border border-indigo-200",
};
