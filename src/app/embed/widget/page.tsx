import { verifyEmbedKey } from "@/lib/embed-auth";
import { WidgetShell } from "./WidgetShell";

/**
 * Self-contained chat widget — FAB + collapsible panel + inbox + thread.
 *
 * Host page embeds this as an iframe. When the user clicks the FAB the
 * iframe posts a `chat-admin:widget` message; the host listens and
 * resizes the iframe to show the panel. When closed, iframe collapses
 * back to FAB-sized so the rest of the host page is unobstructed.
 *
 * Auth + tenant scoping handled exactly the same way as /embed/inbox
 * — tenant API key in `?key=` + Origin/Referer allowlist.
 */
export default async function WidgetPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  try {
    await verifyEmbedKey(key);
  } catch (err) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-white p-4 text-xs text-red-600">
        Auth failed: {err instanceof Error ? err.message : "invalid"}
      </div>
    );
  }

  return <WidgetShell apiKey={key!} />;
}
