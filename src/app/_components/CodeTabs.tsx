"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { SupportedLang } from "./highlight";

export type CodeTab = {
  label: string;
  lang: SupportedLang;
  code: string;
  html: string;
};

export function CodeTabs({ tabs }: { tabs: CodeTab[] }) {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(tabs[active].code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <div className="rounded-2xl bg-ink overflow-hidden shadow-xl">
      <div className="flex items-center justify-between border-b border-white/10 px-3">
        <div role="tablist" className="flex overflow-x-auto">
          {tabs.map((t, i) => (
            <button
              key={t.label}
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                i === active
                  ? "border-white text-white"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded-md hover:bg-white/5 transition-colors shrink-0"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" /> Copy
            </>
          )}
        </button>
      </div>
      <pre className="code-block px-5 py-5 text-sm leading-relaxed font-mono overflow-x-auto">
        <code
          className="code-block"
          dangerouslySetInnerHTML={{ __html: tabs[active].html }}
        />
      </pre>
    </div>
  );
}
