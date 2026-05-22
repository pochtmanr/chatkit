import Link from "next/link";
import { headers } from "next/headers";
import { CodeBlock } from "../_components/CodeBlock";

export const dynamic = "force-dynamic";

const JWT_SHAPE = `{
  "iss":  "holylabs",
  "aud":  "<inbox.id>",          // pk's inbox; cross-inbox tokens are rejected
  "sub":  "<host_user_id>",      // your stable user id, ≤ 256 chars

  "name":       "Roman Dr.",
  "email":      "roman@example.com",
  "avatar_url": "https://…",

  "allowed_kinds": ["support", "order"],

  "external_refs": {             // optional, per-kind allowlist
    "order": ["ord_123", "ord_124"]
  },

  "iat": 1747861200,
  "exp": 1747864800              // iat + ttl_seconds (≤ 3600)
}`;

const MINT_REQUEST = `POST /api/v1/widget-tokens
Authorization: Bearer sk_live_…
Content-Type: application/json

{
  "user_id":       "u_42",
  "name":          "Roman Dr.",
  "email":         "roman@example.com",
  "avatar_url":    "https://example.com/roman.png",
  "allowed_kinds": ["support", "order"],
  "external_refs": { "order": ["ord_123"] },
  "ttl_seconds":   3600
}`;

const MINT_RESPONSE = `{
  "token":      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6…",
  "token_type": "Bearer",
  "expires_at": "2026-05-23T18:00:00.000Z"
}`;

const ERROR_TABLE = [
  ["401", "missing bearer token", "Authorization header empty or non-Bearer."],
  ["401", "invalid server secret", "sk_live_ unknown, malformed, or rotated past grace."],
  ["403", "business is suspended", "Owner's business is past plan limit or paused."],
  ["400", "user_id must be a non-empty string ≤ 256 chars", "Caller passed empty / whitespace / oversize id."],
  ["400", "invalid allowed_kinds entry: …", "Kind not in {support, order, direct}."],
  ["400", "external_refs.<kind> must be a non-empty array ≤ 32 entries", "Per-kind allowlist empty or too large."],
  ["400", "ttl_seconds out of range", "Asked < 300 or > 3600 seconds."],
];

export default async function TokensDocsPage() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const HOST = `${proto}://${host}`;

  return (
    <div className="space-y-10 max-w-[760px]">
      <header className="space-y-2">
        <h2 className="text-[22px] tracking-tight text-ink font-normal">
          Mint a widget token{" "}
          <span className="font-serif-italic text-deep/70">(JWT)</span>
        </h2>
        <p className="text-[14px] text-deep/70 leading-relaxed">
          A widget token is a short-lived HS256 JWT issued by Holylabs.
          One token represents one of your end-users inside one of your
          inboxes. The token rides as a bearer on every{" "}
          <Code>/api/embed/customer/*</Code> request the widget makes.
        </p>
      </header>

      <Section title="The JWT shape">
        <CodeBlock language="jsonc" caption="Decoded payload" code={JWT_SHAPE} />
        <Bullet>
          <strong>alg</strong> is always <Code>HS256</Code>. The{" "}
          <Code>kid</Code> header carries the inbox id so the verifier
          can load the right signing key.
        </Bullet>
        <Bullet>
          <strong>aud</strong> must equal the <Code>inboxes.id</Code> of
          the inbox the <Code>sk_live_…</Code> belongs to. The widget
          rejects cross-inbox tokens at verify time.
        </Bullet>
        <Bullet>
          <strong>sub</strong> is your stable user id. It surfaces as
          the conversation's <Code>external_ref</Code> for{" "}
          <Code>support</Code>-kind conversations.
        </Bullet>
      </Section>

      <Section title="TTL clamping">
        <p>
          The mint endpoint accepts <Code>ttl_seconds</Code> from{" "}
          <Code>300</Code> (5 min) to <Code>3600</Code> (60 min). Values
          outside that range are rejected with a 400; omit it to
          default to 3600.
        </p>
        <p>
          Short tokens scale your blast radius down to a single browser
          session. Long tokens reduce mint traffic. Default to one
          hour; tighten when the user is on a shared device.
        </p>
      </Section>

      <Section title="allowed_kinds">
        <p>
          Each token enumerates which conversation kinds the user can
          create. Three values are recognised:
        </p>
        <ul className="space-y-2 text-[13px] text-deep/70">
          <li>
            <Code>support</Code> — the canonical inbound channel. The
            user's <Code>sub</Code> becomes the conversation's
            <Code>external_ref</Code> implicitly.
          </li>
          <li>
            <Code>order</Code> — order-scoped chat. Pair with{" "}
            <Code>external_refs.order</Code> to restrict which order
            ids this user may attach to.
          </li>
          <li>
            <Code>direct</Code> — agent-to-customer direct line.
            Typically minted in narrow flows.
          </li>
        </ul>
        <p>
          A create-conversation request whose kind is not in{" "}
          <Code>allowed_kinds</Code> returns 401. This lets you mint a
          read-only token (omit a kind) or a kind-locked token without
          shipping a different verifier per inbox.
        </p>
      </Section>

      <Section title="external_refs">
        <p>
          When present, <Code>external_refs[kind]</Code> is the
          allowlist of refs the user may open inside that kind. Example:
          a user with{" "}
          <Code>{`{ order: ["ord_123"] }`}</Code> can only open{" "}
          <Code>ord_123</Code>; trying to open <Code>ord_999</Code> is
          rejected before the conversation is created.
        </p>
        <p>
          When <Code>external_refs[kind]</Code> is absent, the implicit
          ref for <Code>support</Code> is the user's <Code>sub</Code>;
          other kinds require an explicit allowlist.
        </p>
      </Section>

      <Section title="Mint request / response">
        <CodeBlock
          language="http"
          caption={`POST ${HOST}/api/v1/widget-tokens`}
          code={MINT_REQUEST}
        />
        <CodeBlock language="json" caption="200 OK" code={MINT_RESPONSE} />
      </Section>

      <Section title="Refresh">
        <p>
          Round 5 refreshes by reloading the iframe with a freshly
          minted token in the URL. The host page fetches the mint
          endpoint, then sets <Code>iframe.src</Code> with the new{" "}
          <Code>?token=</Code> query string.
        </p>
        <p>
          Round 6 will add an inbound <Code>auth</Code> postMessage so
          the host can hand over a fresh JWT without unmounting the
          iframe. Until then: reload.
        </p>
      </Section>

      <Section title="Failure modes">
        <div className="overflow-x-auto -mx-2 px-2">
          <table className="w-full text-[12px] border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-deep/60">
                <th className="px-3 py-2 border-b border-mist font-medium">Status</th>
                <th className="px-3 py-2 border-b border-mist font-medium">
                  Body
                </th>
                <th className="px-3 py-2 border-b border-mist font-medium">Cause</th>
              </tr>
            </thead>
            <tbody>
              {ERROR_TABLE.map(([status, body, cause]) => (
                <tr key={body} className="align-top">
                  <td className="px-3 py-2 border-b border-mist/60 font-mono tabular-nums text-ink">
                    {status}
                  </td>
                  <td className="px-3 py-2 border-b border-mist/60 font-mono text-deep">
                    {body}
                  </td>
                  <td className="px-3 py-2 border-b border-mist/60 text-deep/70">
                    {cause}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[12px] text-deep/60">
          The widget itself receives a single sanitised{" "}
          <Code>401 invalid token</Code> for any verify-side failure —
          no leaky detail to the browser. The detailed breakdown above
          is for your backend-side debugging only.
        </p>
      </Section>

      <aside className="rounded-2xl border border-mist/80 bg-white p-6 space-y-2 text-[13px] text-deep/70">
        <p>
          The full specification — verifier contract, rotation policy,
          and dual-key grace — lives in{" "}
          <Code>prompts/round-5/0-shared.md §4</Code>.
        </p>
        <p>
          Manage your <Code>sk_live_…</Code> keys at{" "}
          <Link
            href="/dashboard/settings/api-keys"
            className="underline text-deep hover:text-ink"
          >
            Settings → API keys
          </Link>
          .
        </p>
      </aside>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-[16px] font-medium text-ink">{title}</h3>
      <div className="space-y-3 text-[14px] text-deep/80 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <p className="pl-4 border-l-2 border-mist text-[13px] text-deep/70">
      {children}
    </p>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-mist/60 px-1 font-mono text-[12px] text-ink">
      {children}
    </code>
  );
}
