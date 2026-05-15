"use client";

import { useState } from "react";
import { WebDocs } from "./platforms/Web";
import { RnDocs } from "./platforms/RN";
import { IosDocs } from "./platforms/IOS";
import { AndroidDocs } from "./platforms/Android";
import { VanillaDocs } from "./platforms/Vanilla";

type PlatformId = "web" | "rn" | "ios" | "android" | "vanilla";

type Platform = {
  id: PlatformId;
  label: string;
  pkg: string;
  body: React.ComponentType;
};

const PLATFORMS: Platform[] = [
  { id: "web", label: "Next.js / Web", pkg: "@tinychat/react", body: WebDocs },
  {
    id: "rn",
    label: "React Native",
    pkg: "@tinychat/react-native",
    body: RnDocs,
  },
  { id: "ios", label: "iOS Swift", pkg: "TinyChat (SwiftPM)", body: IosDocs },
  {
    id: "android",
    label: "Android",
    pkg: "dev.tinychat:tinychat",
    body: AndroidDocs,
  },
  {
    id: "vanilla",
    label: "Vanilla JS",
    pkg: '<script src="tinychat.js">',
    body: VanillaDocs,
  },
];

export function PlatformTabs() {
  const [active, setActive] = useState<PlatformId>("web");
  const current = PLATFORMS.find((p) => p.id === active) ?? PLATFORMS[0];
  const Body = current.body;

  return (
    <div className="grid lg:grid-cols-[220px_1fr] gap-10">
      {/* Desktop left rail */}
      <aside className="hidden lg:block">
        <nav className="sticky top-24 self-start">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-600 mb-3 px-3">
            Platform
          </p>
          <ul className="space-y-1">
            {PLATFORMS.map((p) => {
              const isActive = p.id === active;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setActive(p.id)}
                    aria-pressed={isActive}
                    className={`w-full text-left rounded-full px-4 py-2 text-[14px] font-medium transition-colors ${
                      isActive
                        ? "bg-ink text-white shadow-sm"
                        : "text-deep/70 hover:bg-mist"
                    }`}
                  >
                    {p.label}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-6 px-3 text-[12px] text-deep/50 font-mono break-all">
            {current.pkg}
          </div>
        </nav>
      </aside>

      <div>
        {/* Mobile horizontal scroller */}
        <div className="lg:hidden -mx-4 sm:-mx-6 mb-8 overflow-x-auto">
          <div className="flex gap-2 px-4 sm:px-6 min-w-max">
            {PLATFORMS.map((p) => {
              const isActive = p.id === active;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActive(p.id)}
                  aria-pressed={isActive}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-[14px] font-medium transition-colors ${
                    isActive
                      ? "bg-ink text-white shadow-sm"
                      : "bg-white text-deep/70 border border-mist hover:bg-mist"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-10">
          <p className="text-[14px] font-medium text-deep/60">
            {current.label}
          </p>
          <h3 className="mt-2 text-3xl sm:text-4xl tracking-tight text-ink font-normal">
            Package{" "}
            <span className="font-serif-italic text-deep">
              {current.pkg}
              <span className="text-deep/40">.</span>
            </span>
          </h3>
        </div>

        <Body />
      </div>
    </div>
  );
}
