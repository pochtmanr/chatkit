"use client";

import { useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import {
  CONVERSATION_STATUSES,
  STATUS_LABELS,
  STATUS_PILL_CLASSES,
  type ConversationStatus,
} from "@/lib/conversation-status";
import { updateConversationStatus } from "@/app/dashboard/_actions/conversations";

interface SiblingInbox {
  id: string;
  name: string;
}

interface Props {
  conversationId: string;
  currentStatus: ConversationStatus;
  /** Other inboxes in the same business — destination options for an
   *  internal transfer. May be empty (only one inbox → external-only). */
  siblingInboxes: SiblingInbox[];
  currentTransferredNote: string | null;
}

export function StatusDropdown({
  conversationId,
  currentStatus,
  siblingInboxes,
  currentTransferredNote,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState<string>(
    siblingInboxes[0]?.id ?? "external",
  );
  const [transferNote, setTransferNote] = useState(currentTransferredNote ?? "");

  function pick(status: ConversationStatus) {
    setError(null);
    if (status === "transferred") {
      setTransferOpen(true);
      setOpen(false);
      return;
    }
    startTransition(async () => {
      const res = await updateConversationStatus({ conversationId, status });
      if (!res.ok) setError(res.error);
      else setOpen(false);
    });
  }

  function commitTransfer() {
    setError(null);
    startTransition(async () => {
      const res = await updateConversationStatus({
        conversationId,
        status: "transferred",
        transferredToInboxId:
          transferTarget !== "external" ? transferTarget : undefined,
        transferredNote: transferNote.trim() || undefined,
      });
      if (!res.ok) setError(res.error);
      else setTransferOpen(false);
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className={`${STATUS_PILL_CLASSES[currentStatus]} inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-60`}
      >
        {STATUS_LABELS[currentStatus]}
        <ChevronDown
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 mt-1.5 z-30 min-w-[220px] rounded-2xl border border-mist bg-white shadow-xl shadow-ink/5 overflow-hidden py-1"
        >
          {CONVERSATION_STATUSES.map((s) => (
            <li key={s}>
              <button
                type="button"
                role="option"
                aria-selected={s === currentStatus}
                onClick={() => pick(s)}
                className="w-full flex items-center gap-2 px-3.5 py-2 text-[14px] text-ink hover:bg-mist/40 transition-colors text-left"
              >
                <span
                  className={`${STATUS_PILL_CLASSES[s]} h-2 w-2 rounded-full p-0`}
                />
                <span className="flex-1">{STATUS_LABELS[s]}</span>
                {s === currentStatus && (
                  <span className="text-[12px] text-deep/50">Current</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {transferOpen && (
        <div
          className="fixed inset-0 z-50 bg-ink/30 grid place-items-center p-4"
          onClick={() => setTransferOpen(false)}
        >
          <div
            className="bg-white rounded-2xl border border-mist shadow-xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[18px] font-medium text-ink">
              Transfer conversation
            </h2>

            <label className="block space-y-2">
              <span className="text-[13px] text-deep/70">Destination</span>
              <select
                value={transferTarget}
                onChange={(e) => setTransferTarget(e.target.value)}
                className="w-full rounded-xl border border-mist bg-white px-3 py-2 text-[14px]"
              >
                {siblingInboxes.map((ib) => (
                  <option key={ib.id} value={ib.id}>
                    Move to inbox: {ib.name}
                  </option>
                ))}
                <option value="external">External / other (note only)</option>
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-[13px] text-deep/70">
                Note (optional, max 280 chars)
              </span>
              <textarea
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value.slice(0, 280))}
                rows={3}
                placeholder="Why? Where to? Anything the next agent should know."
                className="w-full rounded-xl border border-mist bg-white px-3 py-2 text-[14px]"
              />
            </label>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTransferOpen(false)}
                className="rounded-full bg-white border border-mist px-4 py-2 text-[14px] text-ink hover:bg-mist/40 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={commitTransfer}
                disabled={pending}
                className="rounded-full bg-ink text-white px-5 py-2 text-[14px] font-medium hover:bg-deep transition-colors disabled:opacity-60"
              >
                Transfer
              </button>
            </div>

            {error && <p className="text-[13px] text-red-700">{error}</p>}
          </div>
        </div>
      )}

      {error && !transferOpen && (
        <p className="mt-1.5 text-[12px] text-red-700">{error}</p>
      )}
    </div>
  );
}
