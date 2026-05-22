"use client";

import { useState, useTransition } from "react";
import { Copy, Check, RefreshCw, Trash2, ShieldCheck } from "lucide-react";
import {
  createServerSecret,
  rotateServerSecret,
  revokeServerSecret,
} from "@/app/dashboard/_actions/server-secrets";

type Props = {
  inboxId: string;
  inboxName: string;
  hasSecret: boolean;
  prefix: string | null;
  rotatedAt: string | null;
};

export function ServerSecretCard({
  inboxId,
  inboxName,
  hasSecret: initialHasSecret,
  prefix: initialPrefix,
  rotatedAt: initialRotatedAt,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [hasSecret, setHasSecret] = useState(initialHasSecret);
  const [prefix, setPrefix] = useState(initialPrefix);
  const [rotatedAt, setRotatedAt] = useState(initialRotatedAt);
  const [newKey, setNewKey] = useState<{ raw: string; mode: "create" | "rotate" } | null>(null);
  const [copied, setCopied] = useState(false);

  function onCreate() {
    setError(null);
    startTransition(async () => {
      const res = await createServerSecret({ inboxId });
      if (!res.ok) return setError(res.error);
      setHasSecret(true);
      setPrefix(res.prefix);
      setRotatedAt(null);
      setNewKey({ raw: res.rawKey, mode: "create" });
    });
  }

  function onRotate() {
    if (
      !confirm(
        `Rotate the server secret for "${inboxName}"? The previous key keeps minting for 24 hours, then stops.`,
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await rotateServerSecret({ inboxId });
      if (!res.ok) return setError(res.error);
      setPrefix(res.prefix);
      setRotatedAt(new Date().toISOString());
      setNewKey({ raw: res.rawKey, mode: "rotate" });
    });
  }

  function onRevoke() {
    if (
      !confirm(
        `Revoke the server secret for "${inboxName}"? Your host backend will lose minting ability immediately.`,
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await revokeServerSecret({ inboxId });
      if (!res.ok) return setError(res.error);
      setHasSecret(false);
      setPrefix(null);
      setRotatedAt(null);
    });
  }

  function onCopy() {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey.raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function dismissModal() {
    setNewKey(null);
    setCopied(false);
  }

  return (
    <div className="rounded-2xl bg-white border border-mist/80 shadow-[0_1px_2px_rgba(11,11,11,0.04)] p-5 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[14px] font-medium text-ink truncate">
            {inboxName}
          </div>
          <div className="text-[12px] text-deep/60 mt-0.5 flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3" />
            Server secret · for host backend use only
          </div>
        </div>
      </div>

      {hasSecret ? (
        <>
          <div className="rounded-xl bg-ink text-white/90 font-mono text-[13px] px-4 py-3 select-none">
            {prefix}…••••••••••••••••••••
          </div>
          {rotatedAt && (
            <p className="text-[12px] text-deep/60">
              Last rotated {new Date(rotatedAt).toLocaleString()}. Previous key
              keeps minting for 24h.
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onRotate}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-full border border-mist bg-white px-3 py-1.5 text-[12px] font-medium text-ink hover:bg-mist/40 transition-colors disabled:opacity-60"
            >
              <RefreshCw className={`h-3 w-3 ${pending ? "animate-spin" : ""}`} />
              Rotate
            </button>
            <button
              type="button"
              onClick={onRevoke}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[12px] font-medium text-red-700 hover:bg-red-100 transition-colors disabled:opacity-60"
            >
              <Trash2 className="h-3 w-3" />
              Revoke
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[13px] text-deep/70">
            Mint <code className="text-ink">sk_live_…</code> so your host
            backend can issue widget tokens via{" "}
            <code className="text-ink">POST /api/v1/widget-tokens</code>.
          </p>
          <button
            type="button"
            onClick={onCreate}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-full bg-ink text-white px-4 py-2 text-[14px] font-medium hover:bg-deep transition-colors disabled:opacity-60"
          >
            Create server secret
          </button>
        </>
      )}

      {error && (
        <p className="text-[13px] font-medium text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      {newKey && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4"
          onClick={dismissModal}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-white border border-mist/80 shadow-xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1">
              <h3 className="text-[18px] font-medium text-ink">
                {newKey.mode === "create" ? "Save this secret now" : "New secret — save it now"}
              </h3>
              <p className="text-[13px] text-deep/70">
                We won&apos;t show <code className="text-ink">sk_live_…</code>{" "}
                again. Store it in your host backend&apos;s secret manager. If
                you lose it, rotate or revoke it from this page.
              </p>
            </div>
            <div className="rounded-xl bg-ink text-white/90 font-mono text-[12px] px-4 py-3 break-all select-all">
              {newKey.raw}
            </div>
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onCopy}
                className="inline-flex items-center gap-1.5 rounded-full border border-mist bg-white px-4 py-2 text-[14px] font-medium text-ink hover:bg-mist/40 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={dismissModal}
                className="rounded-full bg-ink text-white px-5 py-2 text-[14px] font-medium hover:bg-deep transition-colors"
              >
                I&apos;ve saved it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
