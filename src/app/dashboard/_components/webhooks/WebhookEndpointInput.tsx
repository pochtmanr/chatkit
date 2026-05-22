"use client";

import { useState, useTransition } from "react";
import { setInboxWebhookUrl } from "@/app/dashboard/_actions/webhooks";
import { WebhookTestFireMenu } from "./WebhookTestFireMenu";

export function WebhookEndpointInput({
  inboxId,
  initialUrl,
  subscribedEvents,
}: {
  inboxId: string;
  initialUrl: string | null;
  subscribedEvents: string[];
}) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function onSave(formData: FormData) {
    startTransition(async () => {
      setError(null);
      const raw = String(formData.get("url") ?? "").trim();
      const res = await setInboxWebhookUrl(inboxId, raw || null);
      if (!res.ok) {
        setStatus("error");
        setError(res.error);
        return;
      }
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1500);
    });
  }

  return (
    <div className="space-y-2">
      <form action={onSave} className="flex flex-col sm:flex-row gap-2">
        <input
          name="url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://hooks.example.com/chatkit"
          className="flex-1 rounded-xl border border-mist bg-white px-4 py-2.5 text-[14px] text-ink font-mono placeholder:text-deep/30 focus:outline-none focus:border-deep/40 focus:ring-2 focus:ring-deep/10 transition-all"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-ink text-white px-5 py-2 text-[14px] font-medium hover:bg-deep transition-colors disabled:opacity-60"
          >
            {pending ? "Saving…" : status === "saved" ? "Saved" : "Save"}
          </button>
          <WebhookTestFireMenu
            inboxId={inboxId}
            disabled={!url.trim()}
            subscribedEvents={subscribedEvents}
          />
        </div>
      </form>
      {error && (
        <p className="text-[12px] text-red-700 bg-red-50 border border-red-100 rounded-md px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
