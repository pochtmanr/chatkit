import Link from "next/link";
import { CodeBlock } from "@/app/_components/CodeBlock";
import { Section } from "../Section";

export function VanillaDocs() {
  return (
    <div>
      <Section id="vanilla-install" eyebrow="01" title="Install">
        <p className="text-deep/70 leading-relaxed">
          Drop a single{" "}
          <code className="font-mono text-[13px] bg-mist/60 px-1.5 py-0.5 rounded">
            &lt;script&gt;
          </code>{" "}
          tag into any HTML page — WordPress, Webflow, plain static sites.
          This is the same path our own{" "}
          <Link
            href="/support"
            className="text-deep underline underline-offset-2 decoration-deep/30 hover:text-ink"
          >
            /support page
          </Link>{" "}
          uses.
        </p>
        <CodeBlock
          lang="tsx"
          filename="index.html"
          code={`<script src="https://cdn.tinychat.dev/v1/widget.js" defer></script>`}
        />
      </Section>

      <Section id="vanilla-initialize" eyebrow="02" title="Initialize">
        <p className="text-deep/70 leading-relaxed">
          The loader exposes a queue on{" "}
          <code className="font-mono text-[13px] bg-mist/60 px-1.5 py-0.5 rounded">
            window.tinychat
          </code>
          . Calls made before the script finishes loading are replayed once
          it&apos;s ready, so order is forgiving.
        </p>
        <CodeBlock
          lang="tsx"
          code={`<script>
  window.tinychat = window.tinychat || [];
  window.tinychat.push(["init", { apiKey: "pk_live_xxxxxxxxxxxx" }]);
</script>`}
        />
        <p className="text-deep/70 leading-relaxed">
          Under the hood, the loader mounts the same iframe the dashboard
          embed snippet uses:{" "}
          <code className="font-mono text-[13px] bg-mist/60 px-1.5 py-0.5 rounded">
            /embed/widget?key=&lt;apiKey&gt;
          </code>
          . Every other call (
          <code className="font-mono text-[13px] bg-mist/60 px-1.5 py-0.5 rounded">
            identify
          </code>
          ,{" "}
          <code className="font-mono text-[13px] bg-mist/60 px-1.5 py-0.5 rounded">
            open
          </code>
          ) is forwarded into that iframe as a{" "}
          <code className="font-mono text-[13px] bg-mist/60 px-1.5 py-0.5 rounded">
            postMessage({"{"} type: &quot;chat-admin:open&quot;, … {"}"})
          </code>{" "}
          — the messages the iframe&apos;s{" "}
          <code className="font-mono text-[13px] bg-mist/60 px-1.5 py-0.5 rounded">
            WidgetShell
          </code>{" "}
          already listens for. The host page never talks to the API directly.
        </p>
      </Section>

      <Section id="vanilla-identify" eyebrow="03" title="Identify the user">
        <p className="text-deep/70 leading-relaxed">
          Push an{" "}
          <code className="font-mono text-[13px] bg-mist/60 px-1.5 py-0.5 rounded">
            identify
          </code>{" "}
          payload whenever you know who&apos;s on the page. Subsequent
          messages are sent as that user.
        </p>
        <CodeBlock
          lang="tsx"
          code={`window.tinychat.push([
  "identify",
  {
    id: "u_123",
    name: "Ada Lovelace",
    email: "ada@example.com",
  },
]);`}
        />
      </Section>

      <Section id="vanilla-open" eyebrow="04" title="Open a conversation">
        <p className="text-deep/70 leading-relaxed">
          Programmatically open the support thread — wire it to your &ldquo;Need
          help?&rdquo; button. The loader translates this into{" "}
          <code className="font-mono text-[13px] bg-mist/60 px-1.5 py-0.5 rounded">
            chat-admin:open
          </code>{" "}
          for the embedded iframe.
        </p>
        <CodeBlock
          lang="tsx"
          code={`document
  .querySelector("#need-help")
  .addEventListener("click", () => {
    window.tinychat.push([
      "open",
      { kind: "support", externalRef: "site_support" },
    ]);
  });`}
        />
      </Section>

      <Section id="vanilla-listen" eyebrow="05" title="Listen for events">
        <p className="text-deep/70 leading-relaxed">
          Register a callback for events bubbling up from the iframe. The
          payload shape matches the React SDKs.
        </p>
        <CodeBlock
          lang="tsx"
          code={`window.tinychat.push([
  "on",
  "message",
  (m) => console.log("inbound", m),
]);

window.tinychat.push([
  "on",
  "toggle",
  (open) => console.log("widget open:", open),
]);`}
        />
      </Section>
    </div>
  );
}
