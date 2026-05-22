import Link from "next/link";
import { headers } from "next/headers";
import { ExternalLink } from "lucide-react";
import { getActiveContext } from "@/lib/active-context";
import { CodeBlock } from "../_components/CodeBlock";

export const dynamic = "force-dynamic";

export default async function InstallDocsPage() {
  const ctx = await getActiveContext();
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const HOST = `${proto}://${host}`;
  const pk = ctx?.inbox.api_key ?? "pk_live_…";

  const iframeHtml = `<iframe
  id="holylabs-chat"
  src="${HOST}/embed/customer?key=${pk}&token=<JWT>"
  allow="clipboard-write"
  style="position:fixed; right:16px; bottom:16px; width:80px; height:80px; border:0; z-index:9999; background:transparent;"
></iframe>
<script>
(function () {
  const iframe = document.getElementById("holylabs-chat");
  const HOST_ORIGIN = window.location.origin;
  const NONCE = crypto.randomUUID();
  const WIDGET_ORIGIN = "${HOST}";

  iframe.addEventListener("load", () => {
    iframe.contentWindow.postMessage(
      { v: 1, type: "init", nonce: NONCE, hostOrigin: HOST_ORIGIN },
      WIDGET_ORIGIN
    );
  });

  window.addEventListener("message", (e) => {
    if (e.origin !== WIDGET_ORIGIN) return;
    if (e.data?.v !== 1) return;
    if (e.data.nonce !== NONCE) return;
    if (e.data.type === "open") {
      iframe.style.width  = e.data.open ? "380px" : "80px";
      iframe.style.height = e.data.open ? "560px" : "80px";
    }
  });

  window.holylabsSignOut = function () {
    iframe.contentWindow.postMessage(
      { v: 1, type: "sign-out", nonce: NONCE },
      WIDGET_ORIGIN
    );
  };
})();
</script>`;

  const mintRoute = `// app/api/holylabs-token/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await getMySession(req);
  if (!session) {
    return NextResponse.json({ error: "auth required" }, { status: 401 });
  }

  const res = await fetch("${HOST}/api/v1/widget-tokens", {
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
  return NextResponse.json(await res.json());
}`;

  const signOutSnippet = `// Wherever you sign the user out of your own app
await myAuth.signOut();
window.holylabsSignOut?.();`;

  return (
    <div className="space-y-10 max-w-[760px]">
      <header className="space-y-2">
        <h2 className="text-[22px] tracking-tight text-ink font-normal">
          Install on a website{" "}
          <span className="font-serif-italic text-deep/70">(auth-only)</span>
        </h2>
        <p className="text-[14px] text-deep/70 leading-relaxed">
          The round-5 widget runs in authenticated mode: every request
          carries a short-lived JWT minted by your backend. There is no
          anonymous-visitor path in this round. Allow ~15 minutes.
        </p>
      </header>

      <Step n={1} title="Get your keys">
        <p>
          Each inbox has two credentials. The{" "}
          <Code>pk_live_…</Code> publishable key is browser-safe; the{" "}
          <Code>sk_live_…</Code> server secret stays on your backend.
        </p>
        <p>
          Open{" "}
          <DocsLink href="/dashboard/settings/api-keys">
            Settings → API keys
          </DocsLink>{" "}
          and create an <Code>sk_live_…</Code> for the inbox you're
          embedding. The raw key is shown <strong>once</strong> — copy it
          straight into your backend env as <Code>HOLYLABS_SK_LIVE</Code>.
        </p>
      </Step>

      <Step n={2} title="Add your allowed origin">
        <p>
          Embeds only load on origins explicitly listed for the
          business. Add your production host (and any preview
          environments) under{" "}
          <DocsLink href="/dashboard/settings/business">
            Settings → Business → Embed allowlist
          </DocsLink>
          . Pages on other origins receive a{" "}
          <Code>frame-ancestors</Code> denial.
        </p>
      </Step>

      <Step n={3} title="Configure conversation start options">
        <p>
          Start options are the cards your users tap to begin a chat
          (e.g. <Code>Billing</Code>, <Code>Order help</Code>). Pick
          icons, set required agent skills, and reorder them in{" "}
          <DocsLink href="/dashboard/settings/start-options">
            Settings → Start options
          </DocsLink>
          .
        </p>
      </Step>

      <Step n={4} title="Mint a widget token from your backend">
        <p>
          Authenticate your own user, then call{" "}
          <Code>POST /api/v1/widget-tokens</Code> with the{" "}
          <Code>sk_live_…</Code>. The response carries a JWT bound to
          one user and one inbox.
        </p>
        <CodeBlock language="ts" caption="Next.js Route Handler" code={mintRoute} />
        <p className="text-[12px] text-deep/60">
          Deep dive on the JWT shape, TTL, and per-kind allowlists:{" "}
          <DocsLink href="/dashboard/docs/tokens">
            Mint a widget token
          </DocsLink>
          .
        </p>
      </Step>

      <Step n={5} title="Embed the iframe + handshake">
        <p>
          The browser fetches your mint endpoint, then renders the
          iframe with the JWT in the query string. The{" "}
          <Code>init</Code> postMessage pins the host origin and a
          per-page nonce — every subsequent message must echo the same
          nonce or the widget drops it on the floor.
        </p>
        <CodeBlock language="html" caption="HTML + JS" code={iframeHtml} />
      </Step>

      <Step n={6} title="Wire your sign-out flow">
        <p>
          When your user signs out of your app, call{" "}
          <Code>window.holylabsSignOut()</Code>. The widget closes the
          panel, drops its in-memory token, and unsubscribes from
          realtime until the next <Code>init</Code>.
        </p>
        <CodeBlock language="ts" caption="Sign-out hook" code={signOutSnippet} />
        <p className="text-[12px] text-deep/60">
          More on the destroy semantics:{" "}
          <DocsLink href="/dashboard/docs/sign-out">Sign-out destroy</DocsLink>.
        </p>
      </Step>

      <Step n={7} title="What you should see">
        <p>
          A floating launcher in the bottom-right of your page. Click
          it: the panel expands to 380×560, the conversation list and
          start-option cards render, and the user's name shows in the
          header. In the Holylabs dashboard, the conversation's
          <Code>external_ref</Code> equals the <Code>user_id</Code> you
          passed at mint time.
        </p>
        <div className="rounded-2xl border border-mist bg-white/70 px-5 py-4 text-[12px] text-deep/60">
          Screenshots land here once the greenflagged.com integration
          example is recorded. For now, follow{" "}
          <Code>prompts/round-5/examples/greenflagged-integration.md</Code>{" "}
          end-to-end on your own host.
        </div>
      </Step>

      <aside className="rounded-2xl border border-mist/80 bg-white p-6 space-y-2">
        <h3 className="text-[14px] font-medium text-ink">Next up</h3>
        <ul className="space-y-1.5 text-[13px] text-deep/70">
          <li className="flex items-center gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" />
            <DocsLink href="/dashboard/docs/tokens">
              The widget JWT contract
            </DocsLink>
          </li>
          <li className="flex items-center gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" />
            <DocsLink href="/dashboard/docs/security">
              Security model (what each key can and can't do)
            </DocsLink>
          </li>
        </ul>
      </aside>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-baseline gap-3 text-[16px] font-medium text-ink">
        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-ink text-white text-[11px] font-medium tabular-nums">
          {n}
        </span>
        {title}
      </h3>
      <div className="space-y-3 text-[14px] text-deep/80 leading-relaxed pl-9">
        {children}
      </div>
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-mist/60 px-1 font-mono text-[12px] text-ink">
      {children}
    </code>
  );
}

function DocsLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-deep underline hover:text-ink">
      {children}
    </Link>
  );
}
