"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import {
  ALL_WEBHOOK_EVENTS,
  type WebhookEventKind,
} from "@/lib/tenant-webhook/types";
import { testFireWebhook } from "@/app/dashboard/_actions/webhooks";

const LABELS: Record<WebhookEventKind, string> = {
  message_received: "message_received",
  conversation_status_changed: "conversation_status_changed",
  conversation_assigned: "conversation_assigned",
  conversation_created: "conversation_created",
};

type FireResult = {
  ok: boolean;
  statusCode: number | null;
  body: string;
  durationMs: number;
};

export function WebhookTestFireMenu({
  inboxId,
  disabled,
  subscribedEvents,
}: {
  inboxId: string;
  disabled: boolean;
  subscribedEvents: string[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<WebhookEventKind | null>(null);
  const [result, setResult] = useState<
    { event: WebhookEventKind; result: FireResult } | null
  >(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  async function fire(eventKind: WebhookEventKind) {
    setOpen(false);
    setPending(eventKind);
    setResult(null);
    try {
      const res = await testFireWebhook(inboxId, eventKind);
      if (res.ok) {
        setResult({
          event: eventKind,
          result: {
            ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300,
            statusCode: res.statusCode,
            body: res.responseBody,
            durationMs: res.durationMs,
          },
        });
      } else {
        setResult({
          event: eventKind,
          result: { ok: false, statusCode: null, body: res.error, durationMs: 0 },
        });
      }
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        disabled={disabled || pending !== null}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-full bg-white border border-mist px-4 py-2 text-[13px] font-medium text-ink hover:bg-mist/40 transition-colors disabled:opacity-40"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Test"}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <ul className="absolute right-0 z-20 mt-1 w-64 rounded-xl border border-mist bg-white shadow-lg overflow-hidden text-[13px]">
          {ALL_WEBHOOK_EVENTS.map((ev) => {
            const subscribed = subscribedEvents.includes(ev);
            return (
              <li key={ev}>
                <button
                  type="button"
                  onClick={() => fire(ev)}
                  className="w-full text-left px-4 py-2 hover:bg-mist/40 transition-colors flex items-center justify-between"
                >
                  <span className="font-mono text-[12px]">{LABELS[ev]}</span>
                  {!subscribed && (
                    <span className="text-[10px] uppercase tracking-wide text-amber-700">
                      off
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {result && (
        <div
          className={`absolute right-0 z-20 mt-2 w-80 rounded-xl border bg-white shadow-lg p-3 text-[12px] space-y-1 ${
            result.result.ok
              ? "border-emerald-100"
              : "border-red-100"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono">{result.event}</span>
            <span
              className={
                result.result.ok ? "text-emerald-700" : "text-red-700"
              }
            >
              {result.result.statusCode ?? "ERR"} · {result.result.durationMs}ms
            </span>
          </div>
          <pre className="font-mono break-all whitespace-pre-wrap max-h-32 overflow-y-auto text-deep/70 text-[11px]">
            {result.result.body || "(empty response)"}
          </pre>
          <button
            type="button"
            onClick={() => setResult(null)}
            className="text-[11px] text-deep/60 underline"
          >
            dismiss
          </button>
        </div>
      )}
    </div>
  );
}
