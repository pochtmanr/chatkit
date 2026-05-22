"use client";

import { useState } from "react";
import { ChevronRight, X } from "lucide-react";

export function WebhookPayloadDrawer({
  payload,
  responseBody,
  error,
}: {
  payload: unknown;
  responseBody: string | null;
  error: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-deep/70 hover:text-ink transition-colors"
      >
        payload
        <ChevronRight className="h-3 w-3" />
      </button>
      {open && (
        <div className="fixed inset-0 z-30 bg-ink/40" onClick={() => setOpen(false)}>
          <aside
            className="absolute right-0 top-0 h-full w-full sm:w-[480px] bg-white border-l border-mist shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="sticky top-0 bg-white border-b border-mist px-5 py-3 flex items-center justify-between">
              <h3 className="text-[14px] font-medium text-ink">Webhook delivery</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-md hover:bg-mist/40"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="p-5 space-y-5 text-[12px]">
              <section className="space-y-1.5">
                <h4 className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
                  Request body
                </h4>
                <pre className="rounded-xl bg-ink text-white/90 p-3 font-mono overflow-x-auto text-[11px]">
                  {JSON.stringify(payload ?? {}, null, 2)}
                </pre>
              </section>
              <section className="space-y-1.5">
                <h4 className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
                  Response body
                </h4>
                <pre className="rounded-xl bg-mist/30 border border-mist p-3 font-mono overflow-x-auto text-[11px] text-deep/80">
                  {responseBody || "(empty)"}
                </pre>
              </section>
              {error && (
                <section className="space-y-1.5">
                  <h4 className="text-[12px] uppercase tracking-[0.12em] text-red-700/70">
                    Error
                  </h4>
                  <p className="text-[12px] text-red-700 font-mono break-all">
                    {error}
                  </p>
                </section>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
