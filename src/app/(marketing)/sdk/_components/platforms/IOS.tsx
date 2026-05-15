import Link from "next/link";
import { CodeBlock } from "@/app/_components/CodeBlock";
import { Section } from "../Section";

export function IosDocs() {
  return (
    <div>
      <Section id="ios-install" eyebrow="01" title="Install">
        <p className="text-deep/70 leading-relaxed">
          Add the package via Swift Package Manager. iOS 15+ and Xcode 15+.
        </p>
        <CodeBlock
          lang="swift"
          filename="Package.swift"
          code={`.package(url: "https://github.com/tinychat/tinychat-swift", from: "0.2.0")`}
        />
        <p className="text-deep/70 leading-relaxed">
          Store the publishable key somewhere reachable from your app target —{" "}
          <code className="font-mono text-[13px] bg-mist/60 px-1.5 py-0.5 rounded">
            Info.plist
          </code>
          ,{" "}
          <code className="font-mono text-[13px] bg-mist/60 px-1.5 py-0.5 rounded">
            xcconfig
          </code>
          , or a generated{" "}
          <code className="font-mono text-[13px] bg-mist/60 px-1.5 py-0.5 rounded">
            Env.swift
          </code>
          .
        </p>
      </Section>

      <Section id="ios-initialize" eyebrow="02" title="Initialize">
        <p className="text-deep/70 leading-relaxed">
          Call{" "}
          <code className="font-mono text-[13px] bg-mist/60 px-1.5 py-0.5 rounded">
            TinyChat.configure
          </code>{" "}
          from your{" "}
          <code className="font-mono text-[13px] bg-mist/60 px-1.5 py-0.5 rounded">
            App
          </code>{" "}
          initializer.
        </p>
        <CodeBlock
          lang="swift"
          filename="MyApp.swift"
          code={`import TinyChat

@main
struct MyApp: App {
  init() {
    TinyChat.configure(apiKey: Env.tinychatKey)
  }
  var body: some Scene {
    WindowGroup { ContentView() }
  }
}`}
        />
      </Section>

      <Section id="ios-identify" eyebrow="03" title="Identify the user">
        <p className="text-deep/70 leading-relaxed">
          Call{" "}
          <code className="font-mono text-[13px] bg-mist/60 px-1.5 py-0.5 rounded">
            identify
          </code>{" "}
          after login. Pass the APNs token to wire push fan-out from the
          server.
        </p>
        <CodeBlock
          lang="swift"
          code={`TinyChat.identify(
  id: user.id,
  name: user.name,
  email: user.email,
  apnsToken: apnsToken
)`}
        />
      </Section>

      <Section id="ios-open" eyebrow="04" title="Present a conversation">
        <p className="text-deep/70 leading-relaxed">
          Present the chat sheet from any UIViewController or NavigationStack.
          The kind matches the same{" "}
          <Link
            href="/api-reference#conversations-create"
            className="text-deep underline underline-offset-2 decoration-deep/30 hover:text-ink"
          >
            POST /v1/conversations
          </Link>{" "}
          shape used everywhere else.
        </p>
        <CodeBlock
          lang="swift"
          code={`TinyChat.present(
  from: viewController,
  kind: .order,
  externalRef: order.id
)`}
        />
      </Section>

      <Section id="ios-listen" eyebrow="05" title="Listen for events">
        <p className="text-deep/70 leading-relaxed">
          Subscribe to the publishers exposed on{" "}
          <code className="font-mono text-[13px] bg-mist/60 px-1.5 py-0.5 rounded">
            TinyChat.events
          </code>{" "}
          to update unread counts or fire analytics.
        </p>
        <CodeBlock
          lang="swift"
          code={`TinyChat.events.onMessage { message in
  print("inbound", message)
}

TinyChat.events.onToggle { isOpen in
  print("widget open:", isOpen)
}`}
        />
      </Section>
    </div>
  );
}
