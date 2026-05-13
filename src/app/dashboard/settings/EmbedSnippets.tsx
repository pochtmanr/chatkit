"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Two copy-paste snippets:
 *   1. Server-side JWT signing (Node.js) — goes in the route that
 *      renders the page hosting the iframe.
 *   2. The <iframe> markup itself.
 *
 * The tenant id is pre-baked into the JS snippet so the user doesn't
 * have to lookup the UUID separately. The chat-admin host is taken
 * from window.location so staging deployments work without code edits.
 */
export function EmbedSnippets({
  tenantId,
  defaultHost,
}: {
  tenantId: string;
  defaultHost: string;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const host = defaultHost;

  const signingSnippet = `import jwt from "jsonwebtoken";

// Same value as EMBED_JWT_SECRET on the chat-admin Vercel deploy.
// Generate once with: openssl rand -hex 32
const SECRET = process.env.EMBED_JWT_SECRET;

const TENANT_ID = "${tenantId}";

export function signEmbedToken(adminId: string, adminName?: string) {
  return jwt.sign(
    {
      iss: "isrshipping",
      tid: TENANT_ID,
      uid: adminId,
      name: adminName,
    },
    SECRET,
    { algorithm: "HS256", expiresIn: "1h" }
  );
}`;

  const iframeSnippet = `<iframe
  src="${host}/embed/inbox?token={SIGNED_TOKEN}"
  style={{ width: "100%", height: "600px", border: 0 }}
  title="Inbox"
/>`;

  const copy = async (label: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(label);
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 1500);
    } catch {
      // No-op — old browsers, missing perms. The user can select manually.
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            1. Sign the token on your server
          </label>
          <button
            type="button"
            onClick={() => copy("signing", signingSnippet)}
            className="inline-flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            {copied === "signing" ? (
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
        <pre className="text-xs rounded-lg bg-zinc-900 dark:bg-zinc-950 text-zinc-100 p-3 overflow-x-auto font-mono">
          {signingSnippet}
        </pre>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            2. Render the iframe with the signed token
          </label>
          <button
            type="button"
            onClick={() => copy("iframe", iframeSnippet)}
            className="inline-flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
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
        <pre className="text-xs rounded-lg bg-zinc-900 dark:bg-zinc-950 text-zinc-100 p-3 overflow-x-auto font-mono">
          {iframeSnippet}
        </pre>
      </div>

      <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
        Set <code className="font-mono">EMBED_JWT_SECRET</code> as an env
        var on both sides (chat-admin and your admin server) with the
        same value before this works.
      </div>
    </div>
  );
}
