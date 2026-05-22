"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

const VERIFY_SNIPPET = `import crypto from "node:crypto";

function verify(body: string, header: string, secret: string): boolean {
  const parts = Object.fromEntries(
    header.split(",").map((p) => p.split("=") as [string, string]),
  );
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const signedPayload = \`\${t}.\${body}\`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");
  return header
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .some((p) =>
      crypto.timingSafeEqual(Buffer.from(p.slice(3)), Buffer.from(expected)),
    );
}`;

export function WebhookDocsPanel() {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard
      .writeText(VERIFY_SNIPPET)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }

  return (
    <details className="rounded-2xl bg-white border border-mist/80 shadow-[0_1px_2px_rgba(11,11,11,0.04)] p-5 space-y-3">
      <summary className="cursor-pointer text-[14px] font-medium text-ink">
        Verifying signatures
      </summary>
      <div className="mt-3 space-y-3 text-[13px] text-deep/80 leading-relaxed">
        <p>
          Each request carries{" "}
          <code className="font-mono text-[12px]">
            X-Chatkit-Signature: t=&lt;unix seconds&gt;,v1=&lt;hex&gt;[,v1=&lt;hex&gt;]
          </code>
          . To verify:
        </p>
        <ol className="list-decimal list-inside space-y-1.5">
          <li>Split the header into <code>t</code> and one-or-more <code>v1</code> values.</li>
          <li>Reject if <code>|now − t|</code> exceeds 5 minutes (replay window).</li>
          <li>
            Compute{" "}
            <code className="font-mono">
              expected = HMAC_SHA256(secret, &quot;{`{t}`}.{`{body}`}&quot;)
            </code>{" "}
            in hex. The body is the raw bytes — do not re-encode JSON.
          </li>
          <li>Compare each <code>v1</code> against <code>expected</code> with a constant-time comparator.</li>
          <li>
            Accept if any matches. During a rotation window both the new
            secret and the previous secret produce valid signatures.
          </li>
        </ol>
        <div className="relative">
          <pre className="rounded-xl bg-ink text-white/90 font-mono text-[12px] px-4 py-3 overflow-x-auto">
            {VERIFY_SNIPPET}
          </pre>
          <button
            type="button"
            onClick={copy}
            className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-white/10 text-white px-3 py-1 text-[11px] hover:bg-white/20"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </details>
  );
}
