export type SupportedLang = "tsx" | "swift" | "bash" | "json" | "kotlin";

const TSX_KEYWORDS = new Set([
  "import",
  "export",
  "default",
  "from",
  "return",
  "function",
  "const",
  "let",
  "var",
  "type",
  "interface",
  "async",
  "await",
  "if",
  "else",
  "for",
  "while",
  "true",
  "false",
  "null",
  "undefined",
  "new",
  "class",
  "extends",
  "this",
  "void",
  "in",
  "of",
  "as",
  "typeof",
]);

const SWIFT_KEYWORDS = new Set([
  "import",
  "struct",
  "class",
  "func",
  "var",
  "let",
  "init",
  "return",
  "if",
  "else",
  "for",
  "while",
  "true",
  "false",
  "nil",
  "public",
  "private",
  "internal",
  "static",
  "some",
  "Self",
  "guard",
  "do",
  "try",
  "throws",
]);

const KOTLIN_KEYWORDS = new Set([
  "package",
  "import",
  "class",
  "object",
  "interface",
  "fun",
  "val",
  "var",
  "return",
  "if",
  "else",
  "for",
  "while",
  "when",
  "true",
  "false",
  "null",
  "this",
  "super",
  "public",
  "private",
  "internal",
  "protected",
  "open",
  "override",
  "suspend",
  "data",
  "sealed",
  "companion",
  "in",
  "is",
  "as",
  "by",
  "try",
  "catch",
  "throw",
]);

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};

function esc(input: string): string {
  return input.replace(/[&<>]/g, (c) => ESCAPES[c]);
}

const IDENT_START = /[A-Za-z_$]/;
const IDENT_CONT = /[A-Za-z0-9_$]/;
const DIGIT = /\d/;
const DIGIT_OR_DOT = /[\d.]/;

/** Cheap bash highlighter: shell prompt `$`, long flags (`--foo`), and
 *  quoted strings. Everything else is plain text. Good enough for the
 *  curl snippets on the API reference page. */
function highlightBash(code: string): string {
  let out = "";
  let i = 0;
  const n = code.length;

  while (i < n) {
    const ch = code[i];

    if (ch === "#") {
      const end = code.indexOf("\n", i);
      const stop = end === -1 ? n : end;
      out += `<span class="tok-cmt">${esc(code.slice(i, stop))}</span>`;
      i = stop;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      while (j < n) {
        if (code[j] === "\\") {
          j += 2;
          continue;
        }
        if (code[j] === quote) {
          j++;
          break;
        }
        j++;
      }
      out += `<span class="tok-str">${esc(code.slice(i, j))}</span>`;
      i = j;
      continue;
    }

    if (ch === "$" && (i === 0 || code[i - 1] === "\n" || /\s/.test(code[i - 1]))) {
      out += `<span class="tok-attr">$</span>`;
      i++;
      continue;
    }

    if (ch === "-" && code[i + 1] === "-" && IDENT_START.test(code[i + 2] ?? "")) {
      let j = i + 2;
      while (j < n && (IDENT_CONT.test(code[j]) || code[j] === "-")) j++;
      out += `<span class="tok-key">${esc(code.slice(i, j))}</span>`;
      i = j;
      continue;
    }

    if (ch === "-" && /\s/.test(code[i - 1] ?? " ") && IDENT_START.test(code[i + 1] ?? "")) {
      let j = i + 1;
      while (j < n && IDENT_CONT.test(code[j])) j++;
      out += `<span class="tok-key">${esc(code.slice(i, j))}</span>`;
      i = j;
      continue;
    }

    out += esc(ch);
    i++;
  }

  return out;
}

/** JSON highlighter: keys, strings, numbers, literals. */
function highlightJson(code: string): string {
  let out = "";
  let i = 0;
  const n = code.length;

  while (i < n) {
    const ch = code[i];

    if (ch === '"') {
      let j = i + 1;
      while (j < n) {
        if (code[j] === "\\") {
          j += 2;
          continue;
        }
        if (code[j] === '"') {
          j++;
          break;
        }
        j++;
      }
      // peek ahead past whitespace — if next non-ws is ':' it's a key
      let k = j;
      while (k < n && /\s/.test(code[k])) k++;
      const isKey = code[k] === ":";
      const cls = isKey ? "tok-key" : "tok-str";
      out += `<span class="${cls}">${esc(code.slice(i, j))}</span>`;
      i = j;
      continue;
    }

    if ((ch === "-" && DIGIT.test(code[i + 1] ?? "")) || DIGIT.test(ch)) {
      let j = ch === "-" ? i + 1 : i;
      while (j < n && /[\d.eE+\-]/.test(code[j])) j++;
      out += `<span class="tok-num">${esc(code.slice(i, j))}</span>`;
      i = j;
      continue;
    }

    if (IDENT_START.test(ch)) {
      let j = i;
      while (j < n && IDENT_CONT.test(code[j])) j++;
      const word = code.slice(i, j);
      if (word === "true" || word === "false" || word === "null") {
        out += `<span class="tok-type">${esc(word)}</span>`;
      } else {
        out += esc(word);
      }
      i = j;
      continue;
    }

    out += esc(ch);
    i++;
  }

  return out;
}

function highlightCLike(code: string, keywords: Set<string>): string {
  let out = "";
  let i = 0;
  const n = code.length;

  while (i < n) {
    const ch = code[i];
    const next = code[i + 1];

    if (ch === "/" && next === "*") {
      const end = code.indexOf("*/", i + 2);
      const stop = end === -1 ? n : end + 2;
      out += `<span class="tok-cmt">${esc(code.slice(i, stop))}</span>`;
      i = stop;
      continue;
    }

    if (ch === "/" && next === "/") {
      const end = code.indexOf("\n", i);
      const stop = end === -1 ? n : end;
      out += `<span class="tok-cmt">${esc(code.slice(i, stop))}</span>`;
      i = stop;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      let j = i + 1;
      while (j < n) {
        if (code[j] === "\\") {
          j += 2;
          continue;
        }
        if (code[j] === quote) {
          j++;
          break;
        }
        j++;
      }
      out += `<span class="tok-str">${esc(code.slice(i, j))}</span>`;
      i = j;
      continue;
    }

    if (ch === "@" && next !== undefined && IDENT_START.test(next)) {
      let j = i + 1;
      while (j < n && IDENT_CONT.test(code[j])) j++;
      out += `<span class="tok-attr">${esc(code.slice(i, j))}</span>`;
      i = j;
      continue;
    }

    if (DIGIT.test(ch) && !(i > 0 && IDENT_CONT.test(code[i - 1]))) {
      let j = i;
      while (j < n && DIGIT_OR_DOT.test(code[j])) j++;
      out += `<span class="tok-num">${esc(code.slice(i, j))}</span>`;
      i = j;
      continue;
    }

    if (IDENT_START.test(ch)) {
      let j = i;
      while (j < n && IDENT_CONT.test(code[j])) j++;
      const word = code.slice(i, j);

      if (keywords.has(word)) {
        out += `<span class="tok-key">${esc(word)}</span>`;
      } else if (/^[A-Z]/.test(word)) {
        out += `<span class="tok-type">${esc(word)}</span>`;
      } else if (code[j] === "(") {
        out += `<span class="tok-fn">${esc(word)}</span>`;
      } else {
        out += esc(word);
      }
      i = j;
      continue;
    }

    out += esc(ch);
    i++;
  }

  return out;
}

export function highlight(code: string, lang: SupportedLang): string {
  if (lang === "bash") return highlightBash(code);
  if (lang === "json") return highlightJson(code);
  const keywords =
    lang === "swift"
      ? SWIFT_KEYWORDS
      : lang === "kotlin"
        ? KOTLIN_KEYWORDS
        : TSX_KEYWORDS;
  return highlightCLike(code, keywords);
}
