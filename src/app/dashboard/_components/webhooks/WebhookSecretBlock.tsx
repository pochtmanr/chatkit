"use client";

import { useState, useTransition } from "react";
import { Check, Copy, RotateCcw, X } from "lucide-react";
import {
  clearInboxWebhookSecretPrevious,
  rotateInboxWebhookSecret,
} from "@/app/dashboard/_actions/webhooks";

const ROTATION_GRACE_MS = 24 * 60 * 60 * 1000;

function mask(secret: string): string {
  if (secret.length < 12) return "•".repeat(secret.length);
  return `${secret.slice(0, 6)}…${secret.slice(-4)}`;
}

function formatExpiry(rotatedAt: string): string {
  const ts = Date.parse(rotatedAt);
  if (!Number.isFinite(ts)) return "soon";
  const expiresAt = new Date(ts + ROTATION_GRACE_MS);
  return expiresAt.toLocaleString();
}

export function WebhookSecretBlock({
  inboxId,
  currentSecret,
  previousSecret,
  rotatedAt,
}: {
  inboxId: string;
  /** Masked at the server boundary; the raw value is only ever revealed
   *  in the rotation success dialog. */
  currentSecret: string | null;
  previousSecret: string | null;
  rotatedAt: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [revealed, setRevealed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function onRotate() {
    if (
      !confirm(
        "Rotate the signing secret? The previous secret stays valid for 24 hours unless you discard it.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      setError(null);
      const res = await rotateInboxWebhookSecret(inboxId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setRevealed(res.newSecret);
    });
  }

  function onDiscardPrevious() {
    if (!confirm("Discard the previous secret immediately?")) return;
    startTransition(async () => {
      setError(null);
      const res = await clearInboxWebhookSecretPrevious(inboxId);
      if (!res.ok) setError(res.error);
    });
  }

  function copyRevealed() {
    if (!revealed) return;
    navigator.clipboard
      .writeText(revealed)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <code className="font-mono text-[12px] text-ink bg-mist/30 border border-mist px-2.5 py-1 rounded-md">
          {currentSecret ? mask(currentSecret) : "not configured"}
        </code>
        <button
          type="button"
          onClick={onRotate}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-full border border-mist bg-white px-3 py-1.5 text-[12px] font-medium text-ink hover:bg-mist/40 disabled:opacity-50 transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
          Rotate
        </button>
        {previousSecret && (
          <button
            type="button"
            onClick={onDiscardPrevious}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[12px] font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50 transition-colors"
          >
            <X className="h-3 w-3" />
            Discard previous secret
          </button>
        )}
      </div>
      {previousSecret && rotatedAt && (
        <p className="text-[12px] text-deep/60">
          Previous secret active until {formatExpiry(rotatedAt)} (24 hours).
        </p>
      )}
      {error && <p className="text-[12px] text-red-700">{error}</p>}

      {revealed && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-2">
          <div className="flex items-baseline justify-between">
            <p className="text-[13px] font-medium text-emerald-900">
              New signing secret
            </p>
            <button
              type="button"
              onClick={() => setRevealed(null)}
              className="text-[12px] text-deep/60 underline"
            >
              dismiss
            </button>
          </div>
          <p className="text-[12px] text-emerald-900/80">
            Copy this now — it won&apos;t be shown again. Paste it into your
            webhook receiver before the 24-hour grace window for the previous
            secret expires.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-[12px] text-ink bg-white border border-emerald-200 rounded-md px-3 py-2 break-all">
              {revealed}
            </code>
            <button
              type="button"
              onClick={copyRevealed}
              className="inline-flex items-center gap-1 rounded-full bg-ink text-white px-3 py-2 text-[12px] font-medium hover:bg-deep transition-colors"
            >
              {copied ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
