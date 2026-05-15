"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { highlight, type SupportedLang } from "./highlight";

export function CodeBlock({
  code,
  lang,
  filename,
}: {
  code: string;
  lang: SupportedLang;
  filename?: string;
}) {
  const [copied, setCopied] = useState(false);
  const html = highlight(code, lang);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <div className="rounded-2xl bg-ink overflow-hidden shadow-xl">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="text-xs font-mono text-zinc-400 px-1 truncate">
          {filename ?? lang}
        </span>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded-md hover:bg-white/5 transition-colors shrink-0"
          aria-label={copied ? "Copied" : "Copy code"}
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
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </pre>
    </div>
  );
}
