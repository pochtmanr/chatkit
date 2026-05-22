"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import {
  claimConversation,
  endConversation,
  transferConversation,
} from "../_actions/claim";

export type TransferTarget = {
  userId: string;
  displayName: string;
  status: "online" | "away" | "offline";
  skills: string[];
};

const TRANSFER_SKILL_VISIBLE = 3;

type Props = {
  conversationId: string;
  /** True iff the active conversation is assigned to the caller. */
  assignedToMe: boolean;
  /** True iff the conversation has an assignee at all. */
  hasAssignee: boolean;
  /** Caller is owner or lead — allows reassigning a conversation that's
   *  already assigned to someone else. */
  canReassign: boolean;
  /** Other agents in the business, online-first. */
  transferTargets: TransferTarget[];
};

const STATUS_DOT: Record<TransferTarget["status"], string> = {
  online: "bg-emerald-500",
  away: "bg-amber-400",
  offline: "bg-zinc-400",
};

export function ClaimButton({
  conversationId,
  assignedToMe,
  hasAssignee,
  canReassign,
  transferTargets,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const transferRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!transferOpen) return;
    function onDoc(e: MouseEvent) {
      if (transferRef.current && !transferRef.current.contains(e.target as Node)) {
        setTransferOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setTransferOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [transferOpen]);

  function runClaim() {
    setError(null);
    startTransition(async () => {
      const res = await claimConversation(conversationId);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  function runTransfer(toUserId: string) {
    setError(null);
    setTransferOpen(false);
    startTransition(async () => {
      const res = await transferConversation(conversationId, toUserId);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  function runEnd() {
    setError(null);
    startTransition(async () => {
      const res = await endConversation(conversationId);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  const showClaim = !assignedToMe && (!hasAssignee || canReassign);

  return (
    <div className="flex items-center gap-1.5">
      {showClaim && (
        <button
          type="button"
          onClick={runClaim}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-full bg-ink text-white px-3.5 py-1.5 text-[12px] font-medium hover:bg-deep transition-colors disabled:opacity-50"
        >
          <Check className="h-3 w-3" />
          {hasAssignee ? "Reassign" : "Claim"}
        </button>
      )}

      {assignedToMe && (
        <div ref={transferRef} className="relative">
          <button
            type="button"
            onClick={() => setTransferOpen((v) => !v)}
            disabled={pending || transferTargets.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full border border-mist bg-white text-ink px-3 py-1.5 text-[12px] font-medium hover:bg-mist/40 transition-colors disabled:opacity-50"
          >
            Transfer
            <ChevronDown className="h-3 w-3" />
          </button>
          {transferOpen && (
            <ul
              role="listbox"
              className="absolute right-0 mt-1.5 z-30 min-w-[220px] rounded-2xl border border-mist bg-white shadow-xl shadow-ink/10 overflow-hidden py-1"
            >
              {transferTargets.map((t) => {
                const visible = t.skills.slice(0, TRANSFER_SKILL_VISIBLE);
                const overflow = t.skills.length - visible.length;
                return (
                  <li key={t.userId}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => runTransfer(t.userId)}
                      className="w-full flex items-start gap-2 px-3 py-2 text-[13px] text-ink hover:bg-mist/40 transition-colors text-left"
                    >
                      <span
                        className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${STATUS_DOT[t.status]}`}
                      />
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="flex-1 truncate">{t.displayName}</span>
                          <span className="text-[11px] text-deep/50 capitalize shrink-0">
                            {t.status}
                          </span>
                        </span>
                        {t.skills.length > 0 && (
                          <span className="mt-1 flex flex-wrap gap-1">
                            {visible.map((s) => (
                              <span
                                key={s}
                                className="inline-flex items-center rounded-full bg-mist/60 text-deep px-1.5 py-0.5 text-[10px] font-medium"
                              >
                                {s}
                              </span>
                            ))}
                            {overflow > 0 && (
                              <span
                                className="inline-flex items-center rounded-full bg-mist/40 text-deep/70 px-1.5 py-0.5 text-[10px] font-medium"
                                title={t.skills.slice(TRANSFER_SKILL_VISIBLE).join(", ")}
                              >
                                +{overflow}
                              </span>
                            )}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {(assignedToMe || (hasAssignee && canReassign)) && (
        <button
          type="button"
          onClick={runEnd}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-full border border-mist bg-white text-ink px-3 py-1.5 text-[12px] font-medium hover:bg-mist/40 transition-colors disabled:opacity-50"
        >
          End
        </button>
      )}

      {error && (
        <span className="text-[12px] text-red-700 ml-1.5 max-w-[200px] truncate" title={error}>
          {error}
        </span>
      )}
    </div>
  );
}
