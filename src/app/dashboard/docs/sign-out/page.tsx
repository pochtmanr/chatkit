import Link from "next/link";
import { CodeBlock } from "../_components/CodeBlock";

const SIGN_OUT_PAYLOAD = `{
  "v": 1,
  "type": "sign-out",
  "nonce": "<the handshake nonce>"
}`;

const HOST_HOOK = `// Wherever you sign the user out of your own app.
async function signOut() {
  await myAuth.signOut();                 // your own session teardown
  window.holylabsSignOut?.();             // posts {type: "sign-out"} to the iframe
  // Optional: reload to drop any in-memory state your app holds.
  // window.location.assign("/");
}`;

const REACT_HOOK = `// React example — call from your sign-out button.
function SignOutButton() {
  const { signOut: appSignOut } = useAuth();

  const onClick = async () => {
    await appSignOut();
    // The widget is rendered inside an <iframe>; reach it via the
    // global helper we exposed in the install snippet.
    window.holylabsSignOut?.();
  };

  return <button onClick={onClick}>Sign out</button>;
}`;

export default function SignOutDocsPage() {
  return (
    <div className="space-y-10 max-w-[760px]">
      <header className="space-y-2">
        <h2 className="text-[22px] tracking-tight text-ink font-normal">
          Sign-out destroy{" "}
          <span className="font-serif-italic text-deep/70">(tear-down semantics)</span>
        </h2>
        <p className="text-[14px] text-deep/70 leading-relaxed">
          The widget keeps an in-memory copy of the user's JWT, holds
          open realtime subscriptions, and refetches conversation
          state in the background. When the host user signs out, all
          of that must stop — immediately, not on the next page load.
        </p>
      </header>

      <Section title="Why this matters">
        <p>
          A widget that keeps fetching after sign-out is a security
          and privacy bug. Realtime channels still receive the user's
          messages; cached conversations stay rendered; the next
          person to use the browser sees the previous user's chats.
        </p>
        <p>
          The <Code>sign-out</Code> postMessage exists to give the
          host a one-line way to flip the widget to a clean state
          without unmounting the iframe.
        </p>
      </Section>

      <Section title="The payload">
        <CodeBlock language="json" caption="host → widget" code={SIGN_OUT_PAYLOAD} />
        <p>
          The <Code>nonce</Code> must equal the value the host
          captured during the original <Code>init</Code> handshake —
          the widget drops the message otherwise. Reusing a stale
          nonce after a previous <Code>sign-out</Code> is also
          rejected; the host must send a fresh <Code>init</Code>
          first.
        </p>
      </Section>

      <Section title="Where to call it">
        <p>
          Add the call to whatever your auth provider exposes as the
          sign-out callback. The pattern is two lines: tear down your
          own session, then nudge the widget.
        </p>
        <CodeBlock language="ts" caption="Vanilla JS" code={HOST_HOOK} />
        <CodeBlock language="tsx" caption="React" code={REACT_HOOK} />
      </Section>

      <Section title="Widget behavior after sign-out">
        <ul className="space-y-2 text-[13px] text-deep/70">
          <li>
            <strong>Panel state.</strong> If the chat panel was open,
            it closes. The launcher button stays visible but only as
            a no-op surface until a fresh <Code>init</Code>.
          </li>
          <li>
            <strong>Memory.</strong> The widget drops its in-memory
            JWT copy, conversation lists, and any optimistic message
            queue.
          </li>
          <li>
            <strong>Realtime.</strong> Supabase realtime
            subscriptions for the user's conversations are unsubscribed.
          </li>
          <li>
            <strong>Network.</strong> No further requests go to{" "}
            <Code>/api/embed/customer/*</Code> until a new{" "}
            <Code>init</Code> arrives.
          </li>
          <li>
            <strong>Re-render.</strong> A fresh <Code>init</Code>
            (typically after the next sign-in plus a token mint plus
            an iframe reload) reopens the bridge with a new nonce.
          </li>
        </ul>
      </Section>

      <Section title="Edge cases">
        <Bullet>
          <strong>User closes the tab without signing out.</strong>{" "}
          The JWT expires on its own (5–60 min, set at mint time). No
          server-side revocation in round 5.
        </Bullet>
        <Bullet>
          <strong>JWT expires while panel is open.</strong> The next{" "}
          <Code>/api/embed/customer/*</Code> call returns 401; the
          widget surfaces a reconnect state. Round 6 adds the inbound{" "}
          <Code>auth</Code> message so the host can refresh without
          reloading.
        </Bullet>
        <Bullet>
          <strong>Switch users without reload.</strong> Single-page
          apps that swap user identities in place should call{" "}
          <Code>window.holylabsSignOut()</Code>, then re-mint a token
          for the new user, then reload the iframe with the new{" "}
          <Code>?token=</Code> query string. Round 6 collapses these
          steps into a single message.
        </Bullet>
      </Section>

      <aside className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-[13px] text-amber-800">
        Forgetting the sign-out call is the most common round-5
        integration bug. Add it to your auth provider's logout
        callback the same day you wire the install snippet.
      </aside>

      <p className="text-[12px] text-deep/60">
        Bridge protocol reference:{" "}
        <Code>prompts/round-5/0-shared.md §6</Code>. Widget-side
        implementation:{" "}
        <Code>src/app/embed/customer/useHostBridge.ts</Code>. Linked
        from the{" "}
        <Link href="/dashboard/docs/install" className="underline text-deep hover:text-ink">
          install guide
        </Link>
        .
      </p>
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
