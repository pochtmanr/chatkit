import Link from "next/link";
import { CodeBlock } from "@/app/_components/CodeBlock";
import { Section } from "../Section";

export function WebDocs() {
  return (
    <div>
      <Section id="web-install" eyebrow="01" title="Install">
        <p className="text-deep/70 leading-relaxed">
          Add the React package and your publishable key. The widget renders
          once at the root and follows the user across routes.
        </p>
        <CodeBlock lang="bash" code={`npm i @chatkit/react`} />
        <CodeBlock
          lang="bash"
          filename=".env.local"
          code={`NEXT_PUBLIC_CHATKIT_KEY=pk_live_xxxxxxxxxxxx`}
        />
      </Section>

      <Section id="web-initialize" eyebrow="02" title="Initialize">
        <p className="text-deep/70 leading-relaxed">
          Mount{" "}
          <code className="font-mono text-[13px] bg-mist/60 px-1.5 py-0.5 rounded">
            &lt;ChatKit&gt;
          </code>{" "}
          once in your root layout. The provider hydrates client-side and
          fetches{" "}
          <Link
            href="/api-reference#config"
            className="text-deep underline underline-offset-2 decoration-deep/30 hover:text-ink"
          >
            GET /v1/config
          </Link>{" "}
          on mount.
        </p>
        <CodeBlock
          lang="tsx"
          filename="app/layout.tsx"
          code={`import { ChatKit } from "@chatkit/react";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <ChatKit apiKey={process.env.NEXT_PUBLIC_CHATKIT_KEY} />
      </body>
    </html>
  );
}`}
        />
      </Section>

      <Section id="web-identify" eyebrow="03" title="Identify the user">
        <p className="text-deep/70 leading-relaxed">
          Call{" "}
          <code className="font-mono text-[13px] bg-mist/60 px-1.5 py-0.5 rounded">
            identify
          </code>{" "}
          as soon as you know who the user is. The SDK upserts the profile
          via{" "}
          <Link
            href="/api-reference#users"
            className="text-deep underline underline-offset-2 decoration-deep/30 hover:text-ink"
          >
            POST /v1/users
          </Link>{" "}
          and persists it for the session.
        </p>
        <CodeBlock
          lang="tsx"
          filename="components/identify.tsx"
          code={`"use client";
import { useChatKit } from "@chatkit/react";

export function IdentifyUser({ user }) {
  const chatkit = useChatKit();
  chatkit.identify({
    id: user.id,
    name: user.fullName,
    email: user.email,
  });
  return null;
}`}
        />
      </Section>

      <Section id="web-open" eyebrow="04" title="Open a conversation">
        <p className="text-deep/70 leading-relaxed">
          Deep-link straight into a thread — useful for &ldquo;Chat with
          driver&rdquo; or &ldquo;Contact seller&rdquo; buttons. Pass an{" "}
          <code className="font-mono text-[13px] bg-mist/60 px-1.5 py-0.5 rounded">
            externalRef
          </code>{" "}
          so re-opening returns the same conversation.
        </p>
        <CodeBlock
          lang="tsx"
          code={`chatkit.open({
  externalRef: orderId,
  kind: "order",
  participants: [user.id, driverId],
});`}
        />
      </Section>

      <Section id="web-listen" eyebrow="05" title="Listen for events">
        <p className="text-deep/70 leading-relaxed">
          Hook into widget lifecycle and inbound messages. Under the hood
          the SDK posts to{" "}
          <code className="font-mono text-[13px] bg-mist/60 px-1.5 py-0.5 rounded">
            /api/v1/conversations/:id/messages
          </code>{" "}
          and subscribes to{" "}
          <code className="font-mono text-[13px] bg-mist/60 px-1.5 py-0.5 rounded">
            conv:&lt;id&gt;
          </code>{" "}
          on Supabase Realtime — see{" "}
          <Link
            href="/api-reference#realtime"
            className="text-deep underline underline-offset-2 decoration-deep/30 hover:text-ink"
          >
            Realtime in the API reference
          </Link>
          .
        </p>
        <CodeBlock
          lang="tsx"
          code={`chatkit.on("message", (m) => {
  console.log("inbound", m);
});

chatkit.on("toggle", (open) => {
  console.log("widget open:", open);
});`}
        />
      </Section>
    </div>
  );
}
