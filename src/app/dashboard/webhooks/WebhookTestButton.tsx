"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** "Send test" button — fires a synthetic webhook through the same
 *  pipeline as a real message so the user can verify their endpoint
 *  works without sending an actual chat. Refreshes the page after to
 *  reveal the new delivery row. */
export function WebhookTestButton({
  inboxId,
  disabled,
}: {
  inboxId: string;
  disabled: boolean;
}) {
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
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ inboxId }),
            });
            if (!res.ok) {
              const data = (await res.json().catch(() => null)) as
                | { error?: string }
                | null;
              throw new Error(data?.error ?? `test failed (${res.status})`);
            }
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "test failed");
          } finally {
            setSending(false);
          }
        }}
        className="rounded-full bg-white border border-mist px-4 py-2 text-[13px] font-medium text-ink hover:bg-mist/40 transition-colors disabled:opacity-40"
      >
        {sending ? "Sending…" : "Send test"}
      </button>
      {error && <span className="text-[12px] text-red-700">{error}</span>}
    </div>
  );
}
