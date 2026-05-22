"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/app/dashboard/_components/shared/Avatar";
import {
  STATUS_LABELS,
  STATUS_PILL_CLASSES,
  type ConversationStatus,
} from "@/lib/conversation-status";

export type QueueRowProps = {
  id: string;
  displayName: string;
  inboxName: string;
  status: ConversationStatus;
  statusUpdatedAt: string;
  lastMessage: string | null;
};

function relative(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.max(0, Math.floor(diff / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

// Simple SLA heuristic: a row counts as overdue if the customer is
// waiting on us *and* nothing's moved in over an hour, or if it's new /
// active and hasn't been touched in two hours. Real per-business SLAs
// can wire in here later via the businesses table; the visual stays
// the same.
const SLA_MS_WAITING_SUPPORT = 60 * 60 * 1000;
const SLA_MS_OPEN_GENERIC = 2 * 60 * 60 * 1000;

function isOverdue(status: ConversationStatus, statusUpdatedAt: string): boolean {
  const age = Date.now() - new Date(statusUpdatedAt).getTime();
  if (status === "waiting_support") return age > SLA_MS_WAITING_SUPPORT;
  if (status === "new" || status === "active") return age > SLA_MS_OPEN_GENERIC;
  return false;
}

export function QueueRow(props: QueueRowProps) {
  const pathname = usePathname();
  const href = `/workbench/${props.id}`;
  const active = pathname === href;
  const overdue = isOverdue(props.status, props.statusUpdatedAt);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        (active
          ? "bg-mist/80 border-l-2 border-ink"
          : "border-l-2 border-transparent hover:bg-mist/30") +
        " block px-4 py-3 transition-colors"
      }
    >
      <div className="flex items-start gap-3">
        <Avatar name={props.displayName} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-medium text-ink truncate">
              {props.displayName}
            </span>
            <span className="text-[11px] text-deep/50 shrink-0 flex items-center gap-1.5">
              {overdue && (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-red-500"
                  aria-label="SLA overdue"
                  title="Past response SLA"
                />
              )}
              {relative(props.statusUpdatedAt)}
            </span>
          </div>
          <p className="text-[12px] text-deep/70 truncate mt-0.5">
            {props.lastMessage ?? (
              <span className="italic text-deep/40">No messages yet</span>
            )}
          </p>
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-deep/50">
            <span className="truncate">{props.inboxName}</span>
            <span aria-hidden>·</span>
            <span
              className={`${STATUS_PILL_CLASSES[props.status]} rounded-full px-1.5 py-px text-[10px]`}
            >
              {STATUS_LABELS[props.status]}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
