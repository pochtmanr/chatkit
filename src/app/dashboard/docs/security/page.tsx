import Link from "next/link";

const RULES = [
  {
    rule: "DO NOT put sk_live_… in browser code.",
    body: "The server secret mints JWTs for any user in your inbox. A leaked sk_live_ lets anyone impersonate anyone in the inbox until you rotate. Keep it in your backend env, hand it to your platform's secret manager, never inline it in a React component or commit it to a repo.",
  },
  {
    rule: "DO NOT skip the allowed_origins allowlist.",
    body: "Frame-ancestors enforcement is what stops a phishing site from embedding your branded widget inside their own page and exfiltrating user identity. Add every legitimate host (production + staging + preview) under Settings → Business; leave nothing wildcarded.",
  },
  {
    rule: "DO NOT pass user identity from query strings — mint a JWT.",
    body: "Round 4 widgets carried external_ref in the URL. Round 5 ends that: any user identity claim arrives signed in the JWT or it doesn't arrive at all. Don't reach for ?user_id= as a shortcut; the verifier ignores it.",
  },
  {
    rule: "DO rotate sk_live_… if you suspect a leak.",
    body: "Rotating from Settings → API keys generates a new sk_live_ and keeps the previous one valid for 24h so your backend has a window to swap env vars without dropping mints. After the grace window the old key dies.",
  },
];

const CREDENTIALS = [
  {
    name: "pk_live_… / pk_test_…",
    where: "Browser, in iframe URL.",
    can: "Identify the inbox so the widget knows which signing key to verify the JWT against. Bootstrap the iframe shell.",
    cannot:
      "List conversations, read messages, mint tokens, or speak for a user. Round 5 strips the read authority a publishable key once had.",
  },
  {
    name: "sk_live_…",
    where: "Host backend only. Never the browser.",
    can: "Call POST /api/v1/widget-tokens to mint a JWT bound to one user × one inbox. Round 6+ will add more server APIs gated on the same secret.",
    cannot:
      "Read or write conversations directly. The widget surface stays the only path to per-user data — the secret only mints identity, not access.",
  },
  {
    name: "Widget JWT (HS256)",
    where: "Browser, in Authorization header.",
    can: "Read and write the conversations belonging to the JWT's sub inside the inbox the kid points at. Open new conversations of an allowed_kinds value.",
    cannot:
      "List tenant-wide conversations, touch another user's data, exceed exp (5–60 min), or carry over after sign-out.",
  },
];

export default function SecurityDocsPage() {
  return (
    <div className="space-y-10 max-w-[760px]">
      <header className="space-y-2">
        <h2 className="text-[22px] tracking-tight text-ink font-normal">
          Security model{" "}
          <span className="font-serif-italic text-deep/70">(four rules + the model)</span>
        </h2>
        <p className="text-[14px] text-deep/70 leading-relaxed">
          Round 5 splits one shared inbox key into three credentials,
          each with a tightly scoped capability. The model rewards
          rigour and punishes shortcuts; the four rules below are the
          shortcuts not to take.
        </p>
      </header>

      <section className="space-y-3">
        {RULES.map((r) => (
          <div
            key={r.rule}
            className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 space-y-2"
          >
            <p className="text-[15px] font-medium text-amber-900">{r.rule}</p>
            <p className="text-[13px] text-amber-900/80 leading-relaxed">
              {r.body}
            </p>
          </div>
        ))}
      </section>

      <Section title="Three credential classes">
        <p>
          Round 5 makes the inbox key narrower and adds two new
          credentials. The whole security model rests on which actor
          may hold which credential.
        </p>
        <div className="space-y-3">
          {CREDENTIALS.map((c) => (
            <div
              key={c.name}
              className="rounded-2xl border border-mist/80 bg-white p-5 space-y-2"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h4 className="font-mono text-[13px] text-ink">{c.name}</h4>
                <span className="text-[11px] uppercase tracking-[0.1em] text-deep/50">
                  {c.where}
                </span>
              </div>
              <p className="text-[13px] text-deep/80">
                <span className="font-medium text-emerald-700">Can:</span>{" "}
                {c.can}
              </p>
              <p className="text-[13px] text-deep/80">
                <span className="font-medium text-red-700">Cannot:</span>{" "}
                {c.cannot}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Origin allowlist as defense-in-depth">
        <p>
          The browser enforces <Code>frame-ancestors</Code> against
          the list in <Code>businesses.allowed_origins</Code>. Even if
          an attacker minted a JWT (they can't without your{" "}
          <Code>sk_live_</Code>) and somehow loaded the iframe URL,
          the host page failing the allowlist means the browser
          refuses to display the iframe. Two locks, one door.
        </p>
        <p>
          Add your origins on{" "}
          <Link
            href="/dashboard/settings/business"
            className="underline text-deep hover:text-ink"
          >
            Settings → Business
          </Link>
          . The greenflagged.com setup is a real-world example.
        </p>
      </Section>

      <Section title="JWT signing with HS256 + dual-key rotation">
        <p>
          Each inbox holds a 32-byte HMAC secret in{" "}
          <Code>inboxes.widget_signing_secret</Code>. The verifier
          accepts both the current key and the previous one (until
          the previous is explicitly cleared), so rotation never
          invalidates outstanding tokens in flight.
        </p>
        <p>
          <Code>sk_live_</Code> rotation is independent of the JWT
          signing key. Rotating <Code>sk_live_</Code> stops minting
          on the old secret; rotating the JWT key stops verifying
          old tokens. Two distinct grace windows for two distinct
          risks.
        </p>
      </Section>

      <Section title="Postmessage handshake">
        <p>
          Every message between host and widget carries a per-page
          nonce generated by the host at <Code>init</Code>. The
          widget pins the host origin at the same moment by checking
          three sources agree: <Code>document.referrer</Code>,{" "}
          <Code>event.origin</Code>, and the claimed{" "}
          <Code>hostOrigin</Code>. Any drift, any missing nonce — the
          message is dropped silently.
        </p>
        <p>
          This is what keeps a malicious page that successfully
          smuggles past the origin allowlist from issuing{" "}
          <Code>open</Code> or <Code>sign-out</Code> commands.
        </p>
      </Section>

      <Section title="Sender identity">
        <p>
          When the widget opens or sends a message, the sender id is{" "}
          <Code>claims.sub</Code> — the user id you passed at mint
          time. Your backend cannot spoof this from the browser, and
          the widget cannot override it. The dashboard surfaces it as
          the conversation's <Code>external_ref</Code>.
        </p>
      </Section>

      <Section title="What the publishable key cannot do anymore">
        <p>
          Pre-round-5, <Code>pk_live_</Code> could list conversations
          the inbox held. That capability is gone. The publishable
          key now only:
        </p>
        <ul className="space-y-1.5 text-[13px] text-deep/70 pl-4 list-disc marker:text-deep/40">
          <li>Identifies the inbox (the <Code>kid</Code> resolver).</li>
          <li>Pins the frame-ancestors allowlist for the embed.</li>
        </ul>
        <p>
          If your old integration relied on the listing capability —
          and the answer is almost always "no, only the widget did" —
          move that read to a backend endpoint guarded by{" "}
          <Code>sk_live_</Code>.
        </p>
      </Section>

      <aside className="rounded-2xl border border-mist/80 bg-white p-6 space-y-2 text-[13px] text-deep/70">
        <p>
          Rotate keys at{" "}
          <Link
            href="/dashboard/settings/api-keys"
            className="underline text-deep hover:text-ink"
          >
            Settings → API keys
          </Link>
          . Each card shows the last rotation timestamp and the grace
          window for the previous key.
        </p>
        <p>
          Long-form positioning of the security model lives in the
          round-5 brief —{" "}
          <Code>prompts/round-5-authenticated-widget-brief.md</Code> —
          alongside the threat model the architecture is graded
          against.
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

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-mist/60 px-1 font-mono text-[12px] text-ink">
      {children}
    </code>
  );
}
