"use client";

import { useState, useTransition } from "react";
import { saveInboxWebhook } from "../_actions/inboxes";
import { WebhookTestButton } from "./WebhookTestButton";

export function WebhookRow({
  inboxId,
  inboxName,
  projectName,
  audience,
  initialUrl,
}: {
  inboxId: string;
  inboxName: string;
  projectName: string;
  audience: string;
  initialUrl: string | null;
}) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function save(formData: FormData) {
    startTransition(async () => {
      const raw = String(formData.get("url") ?? "").trim();
      const res = await saveInboxWebhook({ inboxId, url: raw || null });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <div className="rounded-2xl bg-white border border-mist/80 shadow-[0_1px_2px_rgba(11,11,11,0.04)] p-5 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[14px] font-medium text-ink truncate">
            {inboxName}
          </div>
          <div className="text-[12px] text-deep/60 mt-0.5">
            {projectName} · {audience}
          </div>
        </div>
        <WebhookTestButton inboxId={inboxId} disabled={!url} />
      </div>

      <form action={save} className="flex flex-col sm:flex-row gap-2">
        <input
          name="url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-server.com/chat-webhook"
          className="flex-1 rounded-xl border border-mist bg-white px-4 py-2.5 text-[14px] text-ink font-mono placeholder:text-deep/30 focus:outline-none focus:border-deep/40 focus:ring-2 focus:ring-deep/10 transition-all"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-ink text-white px-5 py-2 text-[14px] font-medium hover:bg-deep transition-colors disabled:opacity-60"
        >
          {pending ? "Saving…" : saved ? "Saved" : "Save"}
        </button>
      </form>

      {error && (
        <p className="text-[13px] font-medium text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
