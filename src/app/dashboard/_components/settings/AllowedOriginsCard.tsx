"use client";

import { useState, useTransition } from "react";
import { Check, Globe, Loader2, Plug, Plus, X } from "lucide-react";
import {
  addAllowedOrigin,
  removeAllowedOrigin,
  testAllowedOrigin,
} from "@/app/dashboard/_actions/allowed-origins";

type TestResult =
  | { kind: "ok"; message: string }
  | { kind: "warn"; message: string }
  | { kind: "err"; message: string };

export function AllowedOriginsCard({
  businessId,
  origins,
}: {
  businessId: string;
  origins: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Per-origin test result, keyed by the origin string.
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResult, setTestResult] = useState<Record<string, TestResult>>({});

  function onAdd() {
    setError(null);
    if (!draft.trim()) return;
    startTransition(async () => {
      const res = await addAllowedOrigin({ businessId, origin: draft });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDraft("");
    });
  }

  function onRemove(origin: string) {
    if (!confirm(`Remove ${origin} from the allowlist?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await removeAllowedOrigin({ businessId, origin });
      if (!res.ok) setError(res.error);
      setTestResult((prev) => {
        const next = { ...prev };
        delete next[origin];
        return next;
      });
    });
  }

  async function onTest(origin: string) {
    setTesting((m) => ({ ...m, [origin]: true }));
    setTestResult((m) => {
      const next = { ...m };
      delete next[origin];
      return next;
    });
    try {
      const res = await testAllowedOrigin({ businessId, origin });
      if (!res.ok) {
        setTestResult((m) => ({
          ...m,
          [origin]: { kind: "err", message: res.error },
        }));
        return;
      }
      if (res.status === 200 && res.detail === "iframe should load") {
        setTestResult((m) => ({
          ...m,
          [origin]: { kind: "ok", message: "OK — iframe should load." },
        }));
      } else {
        setTestResult((m) => ({
          ...m,
          [origin]: {
            kind: "warn",
            message: res.detail ?? `chatkit returned ${res.status}`,
          },
        }));
      }
    } finally {
      setTesting((m) => {
        const next = { ...m };
        delete next[origin];
        return next;
      });
    }
  }

  return (
    <section className="rounded-2xl bg-white border border-mist/80 p-6 md:p-8 space-y-4">
      <div className="space-y-1">
        <h2 className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
          Embed allowlist
        </h2>
        <p className="text-[14px] text-deep/70 max-w-3xl">
          Hosts allowed to iframe this business&apos;s widget and inbox. Browsers
          will refuse to load the iframe from any origin not on this list — and
          the API key alone won&apos;t bypass it. Add the exact origin
          (scheme + host + port, no trailing slash) of each site you embed on.
        </p>
      </div>

      {origins.length > 0 ? (
        <ul className="space-y-2">
          {origins.map((origin) => {
            const result = testResult[origin];
            return (
              <li
                key={origin}
                className="rounded-xl border border-mist bg-white px-4 py-3 space-y-2"
              >
                <div className="flex items-center gap-3">
                  <Globe className="h-4 w-4 text-deep/40 shrink-0" />
                  <code className="flex-1 font-mono text-[13px] text-ink break-all">
                    {origin}
                  </code>
                  <button
                    type="button"
                    onClick={() => onTest(origin)}
                    disabled={Boolean(testing[origin]) || pending}
                    className="inline-flex items-center gap-1.5 rounded-full border border-mist px-3 py-1.5 text-[12px] font-medium text-deep hover:bg-mist/40 disabled:opacity-50 transition-colors"
                  >
                    {testing[origin] ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Plug className="h-3 w-3" />
                    )}
                    Test
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(origin)}
                    disabled={pending}
                    aria-label={`Remove ${origin}`}
                    className="p-1.5 rounded-md text-deep/50 hover:text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {result && (
                  <p
                    className={`text-[12px] ${
                      result.kind === "ok"
                        ? "text-emerald-700"
                        : result.kind === "warn"
                          ? "text-amber-700"
                          : "text-red-700"
                    }`}
                  >
                    {result.kind === "ok" && (
                      <Check className="inline h-3 w-3 mr-1" />
                    )}
                    {result.message}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl bg-mist/30 border border-mist px-4 py-3 text-[13px] text-deep/70">
          No origins yet. Until you add one, no host can embed this
          business&apos;s widget.
        </p>
      )}

      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="url"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAdd();
              }
            }}
            placeholder="https://example.com"
            className="flex-1 rounded-xl border border-mist bg-white px-4 py-2.5 text-[14px] text-ink placeholder:text-deep/40 focus:outline-none focus:border-deep/60"
          />
          <button
            type="button"
            onClick={onAdd}
            disabled={!draft.trim() || pending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-ink text-white px-4 py-2.5 text-[14px] font-medium hover:bg-deep disabled:opacity-50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
        {error && <p className="text-[12px] text-red-700">{error}</p>}
        <p className="text-[11px] text-deep/50">
          Example: <code className="text-ink">https://greenflagged.xyz</code> or{" "}
          <code className="text-ink">http://localhost:3000</code> for local dev.
        </p>
      </div>
    </section>
  );
}
