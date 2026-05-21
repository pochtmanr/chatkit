"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, Copy, Check, RefreshCw } from "lucide-react";
import { rotateInboxApiKey } from "../_actions/inboxes";

export function InboxKeyCard({
  inboxId,
  inboxName,
  audience,
  purpose,
  initialApiKey,
}: {
  inboxId: string;
  inboxName: string;
  audience: string;
  purpose: string;
  initialApiKey: string;
}) {
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const masked =
    apiKey.slice(0, 8) +
    "•".repeat(Math.max(0, apiKey.length - 12)) +
    apiKey.slice(-4);

  async function copy() {
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function rotate() {
    if (
      !confirm(
        `Rotate the API key for "${inboxName}"? Any embed using the old key will stop working.`,
      )
    )
      return;
    startTransition(async () => {
      const res = await rotateInboxApiKey(inboxId);
      if (!res.ok) return setError(res.error);
      setApiKey(res.apiKey);
      setRevealed(true);
      setError(null);
    });
  }

  return (
    <div className="rounded-2xl bg-white border border-mist/80 shadow-[0_1px_2px_rgba(11,11,11,0.04)] p-5 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[14px] font-medium text-ink truncate">{inboxName}</div>
          <div className="text-[12px] text-deep/60 mt-0.5">
            {purpose} · {audience}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            className="rounded-full bg-white border border-mist hover:bg-mist/40 p-2 transition-colors"
            aria-label={revealed ? "Hide" : "Reveal"}
          >
            {revealed ? (
              <EyeOff className="h-3.5 w-3.5 text-deep/70" />
            ) : (
              <Eye className="h-3.5 w-3.5 text-deep/70" />
            )}
          </button>
          <button
            type="button"
            onClick={copy}
            className="rounded-full bg-white border border-mist hover:bg-mist/40 p-2 transition-colors"
            aria-label="Copy"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-deep/70" />
            )}
          </button>
          <button
            type="button"
            onClick={rotate}
            disabled={pending}
            className="rounded-full border border-red-200 bg-red-50 hover:bg-red-100 p-2 transition-colors disabled:opacity-60"
            aria-label="Rotate"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 text-red-700 ${pending ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-ink text-white/90 font-mono text-[13px] px-4 py-3 overflow-x-auto select-all">
        {revealed ? apiKey : masked}
      </div>

      {error && (
        <p className="text-[13px] font-medium text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
