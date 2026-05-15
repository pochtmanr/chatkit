import Link from "next/link";
import { CodeBlock } from "@/app/_components/CodeBlock";
import { Section } from "../Section";

export function RnDocs() {
  return (
    <div>
      <Section id="rn-install" eyebrow="01" title="Install">
        <p className="text-deep/70 leading-relaxed">
          Works with Expo (managed or bare) and bare React Native. No native
          linking step — push token forwarding is handled in JS.
        </p>
        <CodeBlock
          lang="bash"
          code={`npm i @tinychat/react-native
# expo install @react-native-async-storage/async-storage`}
        />
        <CodeBlock
          lang="bash"
          filename=".env"
          code={`EXPO_PUBLIC_TINYCHAT_KEY=pk_live_xxxxxxxxxxxx`}
        />
      </Section>

      <Section id="rn-initialize" eyebrow="02" title="Initialize">
        <p className="text-deep/70 leading-relaxed">
          Wrap your navigator in{" "}
          <code className="font-mono text-[13px] bg-mist/60 px-1.5 py-0.5 rounded">
            TinyChatProvider
          </code>
          . The provider mounts an in-app FAB and a full-screen conversation
          view; both are themeable.
        </p>
        <CodeBlock
          lang="tsx"
          filename="App.tsx"
          code={`import { TinyChatProvider } from "@tinychat/react-native";

export default function App() {
  return (
    <TinyChatProvider apiKey={process.env.EXPO_PUBLIC_TINYCHAT_KEY}>
      <RootNavigator />
    </TinyChatProvider>
  );
}`}
        />
      </Section>

      <Section id="rn-identify" eyebrow="03" title="Identify the user">
        <p className="text-deep/70 leading-relaxed">
          Pass the user&apos;s FCM token through{" "}
          <code className="font-mono text-[13px] bg-mist/60 px-1.5 py-0.5 rounded">
            identify
          </code>{" "}
          to enable push notifications. The SDK persists tokens through{" "}
          <Link
            href="/api-reference#users"
            className="text-deep underline underline-offset-2 decoration-deep/30 hover:text-ink"
          >
            POST /v1/users
          </Link>{" "}
          so no extra wiring is needed.
        </p>
        <CodeBlock
          lang="tsx"
          code={`import { useTinyChat } from "@tinychat/react-native";

const tinychat = useTinyChat();
tinychat.identify({
  id: user.id,
  name: user.fullName,
  email: user.email,
  fcmTokens: [fcmToken],
});`}
        />
      </Section>

      <Section id="rn-open" eyebrow="04" title="Open a conversation">
        <p className="text-deep/70 leading-relaxed">
          Use{" "}
          <code className="font-mono text-[13px] bg-mist/60 px-1.5 py-0.5 rounded">
            open
          </code>{" "}
          from any screen to push the conversation view. The deeplink is
          idempotent on{" "}
          <code className="font-mono text-[13px] bg-mist/60 px-1.5 py-0.5 rounded">
            externalRef
          </code>
          .
        </p>
        <CodeBlock
          lang="tsx"
          code={`tinychat.open({
  externalRef: order.id,
  kind: "order",
  participants: [user.id, driver.id],
});`}
        />
      </Section>

      <Section id="rn-listen" eyebrow="05" title="Listen for events">
        <p className="text-deep/70 leading-relaxed">
          Same event surface as web. Useful for unread badges and analytics.
        </p>
        <CodeBlock
          lang="tsx"
          code={`tinychat.on("message", (m) => {
  if (!m.fromSelf) bumpUnread();
});

tinychat.on("toggle", (open) => {
  analytics.track("tinychat_toggle", { open });
});`}
        />
      </Section>
    </div>
  );
}
