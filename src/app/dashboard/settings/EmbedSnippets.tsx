"use client";

import { useState } from "react";
import { Check, Copy, Eye, EyeOff } from "lucide-react";

/**
 * Copy-paste snippet for embedding chat-admin's inbox in another admin
 * panel. Auth is via inbox API key in the URL + Origin/Referer check
 * on chat-admin's end (configured via EMBED_ALLOWED_ORIGINS). Anyone
 * who can see the key can read any conversations the inbox has —
 * treat it like a password.
 */
export function EmbedSnippets({
  inboxId,
  apiKey,
  defaultHost,
}: {
  inboxId: string;
  apiKey: string;
  defaultHost: string;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  const iframeSnippet = `<iframe
  src="${defaultHost}/embed/inbox?key=${apiKey}"
  style={{ width: "100%", height: "600px", border: 0 }}
  title="Inbox"
/>`;

  const reactSnippet = `// In your admin page (React example):
const CHAT_ADMIN = "${defaultHost}";
const API_KEY = process.env.NEXT_PUBLIC_CHATKIT_API_KEY!; // safer than hardcoding

export default function Support() {
  return (
    <iframe
      src={\`\${CHAT_ADMIN}/embed/inbox?key=\${API_KEY}\`}
      style={{ width: "100%", height: "600px", border: 0 }}
      title="Inbox"
    />
  );
}`;

  const copy = async (label: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(label);
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 1500);
    } catch {
      // no-op
    }
  };

  const masked =
    apiKey.slice(0, 8) +
    "•".repeat(Math.max(0, apiKey.length - 12)) +
    apiKey.slice(-4);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-mist bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-medium text-deep/70">
            Inbox API key
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowKey((s) => !s)}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-deep/70 hover:text-ink transition-colors"
            >
              {showKey ? (
                <EyeOff className="h-3 w-3" />
              ) : (
                <Eye className="h-3 w-3" />
              )}
              {showKey ? "Hide" : "Show"}
            </button>
            <button
              type="button"
              onClick={() => copy("key", apiKey)}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-deep/70 hover:text-ink transition-colors"
            >
              {copied === "key" ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {copied === "key" ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
        <code className="block mt-2 font-mono text-[12px] break-all text-ink">
          {showKey ? apiKey : masked}
        </code>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[12px] font-medium text-deep/70">
            iframe snippet
          </label>
          <button
            type="button"
            onClick={() => copy("iframe", iframeSnippet)}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-deep/70 hover:text-ink transition-colors"
          >
            {copied === "iframe" ? (
              <>
                <Check className="h-3 w-3" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" /> Copy
              </>
            )}
          </button>
        </div>
        <pre className="text-[12px] rounded-xl bg-ink text-white/90 px-4 py-3 overflow-x-auto font-mono">
          {iframeSnippet}
        </pre>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[12px] font-medium text-deep/70">
            React / Next.js version (key from env var, recommended)
          </label>
          <button
            type="button"
            onClick={() => copy("react", reactSnippet)}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-deep/70 hover:text-ink transition-colors"
          >
            {copied === "react" ? (
              <>
                <Check className="h-3 w-3" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" /> Copy
              </>
            )}
          </button>
        </div>
        <pre className="text-[12px] rounded-xl bg-ink text-white/90 px-4 py-3 overflow-x-auto font-mono">
          {reactSnippet}
        </pre>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-800 space-y-1">
        <p>
          <strong>Domain check:</strong> chat-admin only accepts iframe
          requests from origins listed in{" "}
          <code className="font-mono">EMBED_ALLOWED_ORIGINS</code>. Add
          your admin host there before the iframe will load.
        </p>
        <p>
          Inbox id (for reference):{" "}
          <code className="font-mono">{inboxId}</code>
        </p>
      </div>
    </div>
  );
}
