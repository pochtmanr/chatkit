"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Copy, Eye, EyeOff, ShieldAlert } from "lucide-react";

/**
 * Round-5 install snippets for the authenticated customer widget.
 *
 *   • HTML+JS — iframe + handshake (recommended for round 5).
 *   • Backend — Next.js route handler that mints a widget JWT
 *     via POST /api/v1/widget-tokens.
 *   • cURL — bare HTTP for debugging the mint endpoint.
 *
 * The publishable key is browser-safe but only bootstraps the widget.
 * The sk_live_ secret never leaves your backend; minted JWTs are what
 * the widget carries.
 */

type TabId = "html" | "backend" | "curl";

const TABS: { id: TabId; label: string }[] = [
  { id: "html", label: "HTML + JS" },
  { id: "backend", label: "Backend mint" },
  { id: "curl", label: "cURL" },
];

export function EmbedSnippets({
  inboxId,
  apiKey,
  defaultHost,
}: {
  inboxId: string;
  apiKey: string;
  defaultHost: string;
}) {
  const [tab, setTab] = useState<TabId>("html");
  const [copied, setCopied] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  // Stable placeholder so the snippet copy doesn't accidentally smuggle
  // a real secret. The dashboard never has the raw sk_live_ in memory —
  // it's only shown once at creation in the API keys page.
  const skPlaceholder = "sk_live_•••••••••••••••••••••••••f4a3";

  const htmlSnippet = `<!-- 1. Your backend mints a widget token after your user signs in. -->
<!-- 2. Inject the token + your publishable key into the iframe URL. -->
<iframe
  id="holylabs-chat"
  src="${defaultHost}/embed/customer?key=${apiKey}&token=<JWT>"
  allow="clipboard-write"
  style="position:fixed; right:16px; bottom:16px; width:80px; height:80px; border:0; z-index:9999; background:transparent;"
></iframe>
<script>
(function () {
  const iframe = document.getElementById("holylabs-chat");
  const HOST_ORIGIN = window.location.origin;
  const NONCE = crypto.randomUUID();
  const WIDGET_ORIGIN = "${defaultHost}";

  // Initial handshake: tell the iframe our origin + a nonce.
  iframe.addEventListener("load", () => {
    iframe.contentWindow.postMessage(
      { v: 1, type: "init", nonce: NONCE, hostOrigin: HOST_ORIGIN },
      WIDGET_ORIGIN
    );
  });

  // Resize based on widget open/close.
  window.addEventListener("message", (e) => {
    if (e.origin !== WIDGET_ORIGIN) return;
    if (e.data?.v !== 1) return;
    if (e.data.nonce !== NONCE) return;
    if (e.data.type === "open") {
      iframe.style.width  = e.data.open ? "380px" : "80px";
      iframe.style.height = e.data.open ? "560px" : "80px";
    }
  });

  // When your user signs out, tear down the widget session.
  // Call window.holylabsSignOut() from your own logout flow.
  window.holylabsSignOut = function () {
    iframe.contentWindow.postMessage(
      { v: 1, type: "sign-out", nonce: NONCE },
      WIDGET_ORIGIN
    );
  };
})();
</script>`;

  const backendSnippet = `// app/api/holylabs-token/route.ts (Next.js Route Handler)
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // 1. Authenticate your own user. Replace with your real auth.
  const session = await getMySession(req);  // → { userId, name, email }
  if (!session) {
    return NextResponse.json({ error: "auth required" }, { status: 401 });
  }

  // 2. Mint a widget token via Holylabs.
  const res = await fetch("${defaultHost}/api/v1/widget-tokens", {
    method: "POST",
    headers: {
      "authorization": \`Bearer \${process.env.HOLYLABS_SK_LIVE}\`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      user_id: session.userId,
      name: session.name,
      email: session.email,
      allowed_kinds: ["support"],
      ttl_seconds: 3600,
    }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "token mint failed" }, { status: 502 });
  }
  const { token, expires_at } = await res.json();
  return NextResponse.json({ token, expires_at });
}

// In your page/layout, fetch this endpoint just before rendering the iframe:
//
//   const { token } = await fetch("/api/holylabs-token", { method: "POST" })
//     .then(r => r.json());
//   iframe.src = \`${defaultHost}/embed/customer\`
//              + \`?key=${apiKey}&token=\${encodeURIComponent(token)}\`;`;

  const curlSnippet = `curl -X POST ${defaultHost}/api/v1/widget-tokens \\
  -H "Authorization: Bearer ${skPlaceholder}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "user_id": "u_test",
    "name": "Test User",
    "email": "test@example.com",
    "allowed_kinds": ["support"]
  }'

# Response:
# {
#   "token": "eyJhbGciOiJIUzI1NiIs…",
#   "token_type": "Bearer",
#   "expires_at": "2026-05-23T18:00:00.000Z"
# }`;

  const snippet =
    tab === "html" ? htmlSnippet : tab === "backend" ? backendSnippet : curlSnippet;

  const copy = async (label: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(label);
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 1500);
    } catch {
      /* clipboard blocked */
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
            Publishable key (browser-safe)
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

      <div role="tablist" className="flex gap-1 border-b border-mist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 -mb-px text-[13px] font-medium transition-colors border-b-2 ${
              tab === t.id
                ? "border-ink text-ink"
                : "border-transparent text-deep/60 hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[12px] font-medium text-deep/70">
            {tab === "html" && "Drop into the host page (recommended)"}
            {tab === "backend" && "Mint a widget JWT from your backend"}
            {tab === "curl" && "Test the mint endpoint from the terminal"}
          </label>
          <button
            type="button"
            onClick={() => copy(tab, snippet)}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-deep/70 hover:text-ink transition-colors"
          >
            {copied === tab ? (
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
        <pre className="text-[12px] rounded-xl bg-ink text-white/90 px-4 py-3 overflow-x-auto font-mono whitespace-pre">
          {snippet}
        </pre>
        {tab === "html" && (
          <p className="text-[11px] text-deep/50">
            Replace <code>&lt;JWT&gt;</code> with the token returned from
            your backend mint endpoint. The handshake nonce gates every
            postMessage in both directions — see{" "}
            <Link
              href="/dashboard/docs/install"
              className="underline hover:text-ink"
            >
              the install guide
            </Link>
            .
          </p>
        )}
        {tab === "backend" && (
          <p className="text-[11px] text-deep/50">
            Create your <code>sk_live_…</code> on the{" "}
            <Link
              href="/dashboard/settings/api-keys"
              className="underline hover:text-ink"
            >
              API keys page
            </Link>{" "}
            and store it as <code>HOLYLABS_SK_LIVE</code> in your backend
            env. The raw key is shown once.
          </p>
        )}
        {tab === "curl" && (
          <p className="text-[11px] text-deep/50">
            <code>allowed_kinds</code> may include{" "}
            <code>support</code>, <code>order</code>, or{" "}
            <code>direct</code>. <code>ttl_seconds</code> is clamped to{" "}
            <code>[300, 3600]</code>.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-800 flex gap-2">
        <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p>
            <strong>Never put <code>sk_live_…</code> in browser code.</strong>{" "}
            Mint tokens server-side only. See{" "}
            <Link
              href="/dashboard/docs/security"
              className="underline hover:text-amber-900"
            >
              the security model
            </Link>{" "}
            for the full rules.
          </p>
          <p>
            Embeds only load on origins listed under{" "}
            <Link
              href="/dashboard/settings/business"
              className="underline hover:text-amber-900"
            >
              Settings → Business → Embed allowlist
            </Link>
            .
          </p>
        </div>
      </div>

      <p className="text-[11px] text-deep/50">
        Coming in v0.6: a drop-in React provider that handles the token
        fetch, iframe mount, and sign-out wiring for you. Inbox id (for
        reference): <code className="font-mono">{inboxId}</code>
      </p>
    </div>
  );
}
