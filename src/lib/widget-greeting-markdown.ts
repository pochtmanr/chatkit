/**
 * Minimal markdown renderer for the widget greeting.
 *
 * Supports exactly two patterns:
 *   - **bold** → <strong>bold</strong>
 *   - [label](https://…) → <a target=_blank rel=noopener noreferrer>label</a>
 *
 * Everything else is HTML-escaped, including `<` `>` `&` and any
 * markdown the user might paste in.
 *
 * Used both in the dashboard's live preview and the customer widget
 * server-render. The server-side validator in
 * src/app/dashboard/_actions/widget-config.ts rejects anything outside
 * this grammar, so by the time text reaches this renderer it has
 * already been screened; defense-in-depth here keeps an injection out
 * if validation drifts.
 */

const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPE_MAP[c] ?? c);
}

function escapeAttr(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPE_MAP[c] ?? c);
}

export function renderGreetingMarkdown(input: string): string {
  if (!input) return "";

  // 1. Replace links FIRST so we don't accidentally treat the URL
  //    halves as text content with **bold** inside. We capture label
  //    and URL, validate https://, and emit an <a>. Anything that
  //    doesn't match the strict pattern falls through to text.
  type Token = { kind: "text" | "html"; value: string };
  const tokens: Token[] = [];

  const linkRe = /\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g;
  let last = 0;
  for (let m = linkRe.exec(input); m !== null; m = linkRe.exec(input)) {
    if (m.index > last) {
      tokens.push({ kind: "text", value: input.slice(last, m.index) });
    }
    const label = m[1];
    const href = m[2];
    tokens.push({
      kind: "html",
      value: `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`,
    });
    last = m.index + m[0].length;
  }
  if (last < input.length) {
    tokens.push({ kind: "text", value: input.slice(last) });
  }

  // 2. Within each text token, apply **bold** then escape.
  return tokens
    .map((t) => {
      if (t.kind === "html") return t.value;
      let escaped = escapeHtml(t.value);
      // The escape step turned `**` into `**` (untouched), so the bold
      // regex still works on the escaped string.
      escaped = escaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      return escaped;
    })
    .join("");
}

// Convenience alias for the dashboard preview pane — same renderer,
// kept distinct so a future divergence (e.g. a "...visit our docs"
// affordance) doesn't have to refactor both call sites.
export const renderGreetingPreview = renderGreetingMarkdown;
