import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { InstallTabs, type InstallTab } from "../InstallTabs";
import { highlight, type SupportedLang } from "../highlight";

export default function Install() {
  const tabs: InstallTab[] = INSTALL_TABS.map((t) => ({
    ...t,
    html: highlight(t.code, t.lang),
  }));

  return (
    <section id="install" className="mx-auto max-w-7xl px-4 sm:px-6 py-24">
      <div className="w-full max-w-7xl mx-auto">
        <div className="bg-mist rounded-[48px] border border-mist shadow-sm overflow-hidden">
          <div className="bg-white rounded-[40px] m-2 shadow-sm">
            <div className="p-8 md:p-10 lg:p-12">
              <div className="grid lg:grid-cols-[1fr_2fr] gap-8 lg:gap-12 items-stretch">
                <div>
                  <p className="text-[14px] font-medium text-deep/60">Install</p>
                  <h2 className="mt-4 text-4xl sm:text-5xl tracking-tight text-ink leading-[1] font-normal">
                    Two lines{" "}
                    <span className="font-serif-italic font-normal text-deep">
                      and you&apos;re live
                      <span className="text-deep/40">.</span>
                    </span>
                  </h2>
                  <p className="mt-5 text-deep/70 leading-relaxed text-[16px] font-normal">
                    One package per platform, one env var, zero backend. Render
                    the widget, paste your API key, and start receiving tickets
                    in your ChatKit inbox.
                  </p>
                  <div className="mt-6 inline-flex items-center gap-2 rounded-lg border border-mist bg-mist/40 px-3 py-2 font-mono text-xs text-deep shadow-sm">
                    <span className="text-deep/40">$</span>
                    npm i @chatkit/react
                  </div>
                </div>
                <InstallTabs tabs={tabs} />
              </div>
            </div>
          </div>

          {/* Bottom strip in mist */}
          <div className="px-6 sm:px-12 md:px-16 lg:px-20 py-5 flex flex-col md:flex-row justify-between items-center gap-6 text-[15px]">
            <p className="text-deep/70 font-medium">
              Need more depth? See the full API reference.
            </p>
            <Link
              href="/api-reference"
              className="inline-flex items-center gap-2 text-deep font-medium hover:text-ink transition-colors"
            >
              API reference
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

const INSTALL_TABS: { label: string; lang: SupportedLang; code: string }[] = [
  {
    label: "Next.js",
    lang: "tsx",
    code: `// app/layout.tsx
import { ChatKit } from "@chatkit/react";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <ChatKit apiKey={process.env.NEXT_PUBLIC_CHATKIT_KEY} />
      </body>
    </html>
  );
}`,
  },
  {
    label: "React Native",
    lang: "tsx",
    code: `// App.tsx
import { ChatKitProvider } from "@chatkit/react-native";

export default function App() {
  return (
    <ChatKitProvider apiKey={process.env.EXPO_PUBLIC_CHATKIT_KEY}>
      <RootNavigator />
    </ChatKitProvider>
  );
}`,
  },
  {
    label: "iOS Swift",
    lang: "swift",
    code: `// AppDelegate.swift
import ChatKit

@main
struct MyApp: App {
  init() {
    ChatKit.configure(apiKey: Env.chatkitKey)
  }
  var body: some Scene {
    WindowGroup { ContentView() }
  }
}`,
  },
];
