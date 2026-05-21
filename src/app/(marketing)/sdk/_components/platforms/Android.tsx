import Link from "next/link";
import { CodeBlock } from "@/app/_components/CodeBlock";
import { Section } from "../Section";

export function AndroidDocs() {
  return (
    <div>
      <Section id="android-install" eyebrow="01" title="Install">
        <p className="text-deep/70 leading-relaxed">
          Pull the package from Maven Central. Min SDK 24, target SDK 34.
        </p>
        <CodeBlock
          lang="kotlin"
          filename="build.gradle.kts"
          code={`dependencies {
  implementation("cc.chatkit:chatkit:0.2.0")
}`}
        />
        <CodeBlock
          lang="bash"
          filename="local.properties"
          code={`CHATKIT_KEY=pk_live_xxxxxxxxxxxx`}
        />
      </Section>

      <Section id="android-initialize" eyebrow="02" title="Initialize">
        <p className="text-deep/70 leading-relaxed">
          Configure once in your{" "}
          <code className="font-mono text-[13px] bg-mist/60 px-1.5 py-0.5 rounded">
            Application
          </code>{" "}
          subclass. The SDK lazily attaches itself to the foreground activity
          on first use.
        </p>
        <CodeBlock
          lang="kotlin"
          filename="Application.kt"
          code={`class MyApp : Application() {
  override fun onCreate() {
    super.onCreate()
    ChatKit.configure(this, BuildConfig.CHATKIT_KEY)
  }
}`}
        />
      </Section>

      <Section id="android-identify" eyebrow="03" title="Identify the user">
        <p className="text-deep/70 leading-relaxed">
          Call{" "}
          <code className="font-mono text-[13px] bg-mist/60 px-1.5 py-0.5 rounded">
            identify
          </code>{" "}
          after sign-in. Push tokens are picked up automatically when you
          pass them in.
        </p>
        <CodeBlock
          lang="kotlin"
          code={`ChatKit.identify(
  id = user.id,
  name = user.name,
  email = user.email,
  fcmToken = fcmToken
)`}
        />
      </Section>

      <Section id="android-open" eyebrow="04" title="Open a conversation">
        <p className="text-deep/70 leading-relaxed">
          Launches the chat activity. Same idempotency rules as everywhere
          else — see{" "}
          <Link
            href="/api-reference#conversations-create"
            className="text-deep underline underline-offset-2 decoration-deep/30 hover:text-ink"
          >
            create conversation
          </Link>
          .
        </p>
        <CodeBlock
          lang="kotlin"
          code={`ChatKit.present(
  context = this,
  kind = ConversationKind.ORDER,
  externalRef = order.id
)`}
        />
      </Section>

      <Section id="android-listen" eyebrow="05" title="Listen for events">
        <p className="text-deep/70 leading-relaxed">
          Collect from the SDK&apos;s coroutine flows in a lifecycle-aware
          scope.
        </p>
        <CodeBlock
          lang="kotlin"
          code={`lifecycleScope.launch {
  ChatKit.events.messages.collect { message ->
    Log.d("ChatKit", "inbound $message")
  }
}

lifecycleScope.launch {
  ChatKit.events.toggles.collect { isOpen ->
    Log.d("ChatKit", "widget open: $isOpen")
  }
}`}
        />
      </Section>
    </div>
  );
}
