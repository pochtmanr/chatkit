"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** "Send test" button — fires a synthetic webhook through the same
 *  pipeline as a real message so the user can verify their endpoint
 *  works without sending an actual chat. Refreshes the page after to
 *  reveal the new delivery row. */
export function WebhookTestButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={disabled || sending}
        onClick={async () => {
          setSending(true);
          setError(null);
          try {
            const res = await fetch("/api/dashboard/webhooks/test", {
              method: "POST",
            });
            if (!res.ok) {
              const data = (await res.json().catch(() => null)) as
                | { error?: string }
                | null;
              throw new Error(data?.error ?? `test failed (${res.status})`);
            }
            // Reload the server component to pick up the new delivery row.
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "test failed");
          } finally {
            setSending(false);
          }
        }}
        className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-40"
      >
        {sending ? "Sending…" : "Send test"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
