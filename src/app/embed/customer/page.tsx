import { verifyEmbedKey } from "@/lib/embed-auth";
import { verifyWidgetToken } from "@/lib/widget-token";
import { getServiceClient } from "@/lib/supabase/server";
import { WidgetShell } from "./WidgetShell";
import { WIDGET_DEFAULTS, type WidgetTheme } from "./_lib/theme";

/**
 * Customer widget surface. Authenticated end-user only — round 5 does
 * not support anonymous visitors here (that arrives in round 6 behind
 * an `auth_mode` flag).
 *
 * URL contract: `?key=<pk_live_…>&token=<widget JWT>`. The host backend
 * mints the JWT via POST /api/v1/widget-tokens (prompt 1) and embeds
 * the iframe with both query params. Tokens in the URL bar appear in
 * browser history; round 6's React SDK swaps to a postMessage handoff.
 */
export default async function CustomerWidgetPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; token?: string }>;
}) {
  const { key, token } = await searchParams;
  if (!key || !token) return <NotAuthorized />;

  try {
    await verifyEmbedKey(key);
  } catch {
    return <NotAuthorized />;
  }

  const result = await verifyWidgetToken(token, key);
  if (!result.ok) return <NotAuthorized />;

  const theme = await loadWidgetTheme(result.businessId);

  return (
    <WidgetShell
      pk={key}
      token={token}
      claims={result.claims}
      theme={theme}
    />
  );
}

async function loadWidgetTheme(businessId: string): Promise<WidgetTheme> {
  const admin = getServiceClient();
  const { data: row } = await admin
    .from("widget_config")
    .select(
      "primary_color, roundness, button_style, bubble_style, launcher_icon_url, launcher_icon_preset, greeting_message",
    )
    .eq("business_id", businessId)
    .maybeSingle();
  if (!row) return WIDGET_DEFAULTS;
  return {
    primary_color: row.primary_color ?? WIDGET_DEFAULTS.primary_color,
    roundness: (row.roundness ?? WIDGET_DEFAULTS.roundness) as WidgetTheme["roundness"],
    button_style: (row.button_style ?? WIDGET_DEFAULTS.button_style) as WidgetTheme["button_style"],
    bubble_style: (row.bubble_style ?? WIDGET_DEFAULTS.bubble_style) as WidgetTheme["bubble_style"],
    launcher_icon_url: row.launcher_icon_url,
    launcher_icon_preset: row.launcher_icon_preset,
    greeting_message: row.greeting_message,
  };
}

function NotAuthorized() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        padding: 24,
        fontFamily: "system-ui, sans-serif",
        fontSize: 13,
        color: "#71717a",
        background: "transparent",
      }}
    >
      Authentication required. The host app must mint a widget token
      via <code>POST /api/v1/widget-tokens</code> and include it as{" "}
      <code>&amp;token=…</code> in the iframe URL alongside{" "}
      <code>?key=…</code>. See{" "}
      <code>prompts/round-5/6-host-integration.md</code>.
    </div>
  );
}
