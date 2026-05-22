"use client";

import { useState, useTransition } from "react";
import { setInboxWebhookEvents } from "@/app/dashboard/_actions/webhooks";
import {
  ALL_WEBHOOK_EVENTS,
  type WebhookEventKind,
} from "@/lib/tenant-webhook/types";

const DESCRIPTIONS: Record<WebhookEventKind, string> = {
  message_received:
    "Inbound or outbound message landed on a conversation.",
  conversation_status_changed:
    "Status moved between new/active/waiting/done.",
  conversation_assigned:
    "An agent picked up (or was auto-assigned to) a conversation.",
  conversation_created:
    "Visitor opened a new conversation through the embed widget.",
};

export function WebhookEventsList({
  inboxId,
  initialEvents,
}: {
  inboxId: string;
  initialEvents: string[];
}) {
  const [events, setEvents] = useState<Set<string>>(
    () => new Set(initialEvents),
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggle(event: WebhookEventKind) {
    setEvents((prev) => {
      const next = new Set(prev);
      if (next.has(event)) next.delete(event);
      else next.add(event);
      const ordered = ALL_WEBHOOK_EVENTS.filter((e) => next.has(e));
      startTransition(async () => {
        setError(null);
        const res = await setInboxWebhookEvents(inboxId, ordered);
        if (!res.ok) {
          setError(res.error);
          setEvents(prev);
          return;
        }
        setSaved(true);
        setTimeout(() => setSaved(false), 1200);
      });
      return next;
    });
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-1.5">
        {ALL_WEBHOOK_EVENTS.map((ev) => {
          const checked = events.has(ev);
          return (
            <li key={ev}>
              <label className="flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-mist/30 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-mist text-ink focus:ring-deep/30"
                  checked={checked}
                  onChange={() => toggle(ev)}
                  disabled={pending}
                />
                <span className="space-y-0.5">
                  <span className="block font-mono text-[12px] text-ink">
                    {ev}
                  </span>
                  <span className="block text-[12px] text-deep/60">
                    {DESCRIPTIONS[ev]}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {pending && <p className="text-[11px] text-deep/50">Saving…</p>}
      {saved && !pending && (
        <p className="text-[11px] text-emerald-700">Saved.</p>
      )}
      {error && <p className="text-[12px] text-red-700">{error}</p>}
    </div>
  );
}
