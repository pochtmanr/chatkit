import { highlight, type SupportedLang } from "@/app/_components/highlight";
import type { CodeTab } from "@/app/_components/CodeTabs";

export const BASE_URL = "https://api.chatkit.cc";
export const SAMPLE_KEY = "pk_live_REPLACE_ME";

/** Pre-highlight at module load — every page render reuses the cached
 *  HTML, avoiding a string-walk per request. */
export function tabs(
  entries: { label: string; lang: SupportedLang; code: string }[],
): CodeTab[] {
  return entries.map((t) => ({ ...t, html: highlight(t.code, t.lang) }));
}
