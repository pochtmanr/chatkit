"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import type { WidgetClaims } from "@/lib/widget-token";
import { ConversationList } from "./ConversationList";
import { ThreadPanel } from "./ThreadPanel";
import { customerFetch } from "./_lib/client";
import {
  WIDGET_DEFAULTS,
  panelRadius,
  roundnessToRadius,
  type WidgetTheme,
} from "./_lib/theme";
import { renderLauncherIcon } from "./_lib/launcher-icons";
import { useHostBridge, type HostOpenCommand } from "./useHostBridge";

/**
 * Toggling FAB + chat panel.
 *
 * State machine:
 *   "closed"  → only the FAB visible; host iframe collapsed to FAB size
 *   "list"    → panel open, showing the list of conversations
 *   "thread"  → panel open, showing one conversation's messages
 *
 * Theming: every styled surface reads from `theme` via CSS variables.
 * The dashboard's WidgetAppearanceForm writes a `widget_config` row that
 * `page.tsx` resolves on each iframe load.
 */
type View = "closed" | "list" | "thread";

export function WidgetShell({
  pk,
  token,
  claims,
  theme = WIDGET_DEFAULTS,
}: {
  pk: string;
  token: string;
  claims: WidgetClaims;
  theme?: WidgetTheme;
}) {
  const [view, setView] = useState<View>("closed");
  const [openConvId, setOpenConvId] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);

  const fetcher = useMemo(() => customerFetch({ pk, token }), [pk, token]);

  const openCmdHandler = useCallback(
    async (cmd: HostOpenCommand) => {
      if (signedOut) return;
      if (!cmd.externalRef && !cmd.startOptionId) {
        setOpenConvId(null);
        setView("list");
        return;
      }
      try {
        const res = await fetcher("/api/embed/customer/conversations/find", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...(cmd.startOptionId
              ? { start_option_id: cmd.startOptionId }
              : { kind: cmd.kind ?? "support", external_ref: cmd.externalRef }),
          }),
        });
        if (res.ok) {
          const { conversation } = (await res.json()) as {
            conversation: { id: string };
          };
          setOpenConvId(conversation.id);
          setView("thread");
          return;
        }
      } catch {
        // fall through to list
      }
      setOpenConvId(null);
      setView("list");
    },
    [fetcher, signedOut],
  );

  const closeHandler = useCallback(() => setView("closed"), []);
  const signOutHandler = useCallback(() => {
    setSignedOut(true);
    setOpenConvId(null);
    setView("closed");
  }, []);

  const { post } = useHostBridge({
    onOpen: openCmdHandler,
    onClose: closeHandler,
    onSignOut: signOutHandler,
  });

  useEffect(() => {
    post("open", view !== "closed");
  }, [view, post]);

  if (signedOut) {
    return <div aria-hidden style={{ display: "none" }} />;
  }

  const openList = () => {
    setOpenConvId(null);
    setView("list");
  };
  const openThread = (id: string) => {
    setOpenConvId(id);
    setView("thread");
  };
  const backToList = () => {
    setOpenConvId(null);
    setView("list");
  };

  // CSS variables drive every themed surface inside the iframe. Set
  // them on the root container so descendants inherit; using inline
  // `style` keeps them out of the layout-level <style> tag which
  // would have to re-resolve `searchParams` separately.
  const rootStyle: React.CSSProperties = {
    ["--hl-primary" as string]: theme.primary_color,
    ["--hl-primary-tint" as string]: hexToRgba(theme.primary_color, 0.12),
    ["--hl-radius" as string]: roundnessToRadius(theme.roundness),
    ["--hl-panel-radius" as string]: panelRadius(theme.roundness),
    ["--hl-button-style" as string]: theme.button_style,
    ["--hl-bubble-style" as string]: theme.bubble_style,
  };

  return (
    <div
      className="fixed inset-0 flex items-end justify-end pointer-events-none"
      style={rootStyle}
      data-bubble-style={theme.bubble_style}
      data-button-style={theme.button_style}
    >
      {view !== "closed" && (
        <div
          className="pointer-events-auto bg-white shadow-2xl border border-zinc-200 flex flex-col overflow-hidden w-full h-full"
          style={{ borderRadius: "var(--hl-panel-radius)" }}
        >
          <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 bg-white">
            <span className="text-sm font-semibold text-zinc-900">
              {view === "thread"
                ? "Conversation"
                : claims.name || claims.email || "Support inbox"}
            </span>
            <button
              type="button"
              onClick={closeHandler}
              aria-label="Close"
              className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-500"
            >
              <X className="h-4 w-4" />
            </button>
          </header>
          <div className="flex-1 min-h-0">
            {view === "list" && (
              <ConversationList
                fetcher={fetcher}
                primaryColor={theme.primary_color}
                greeting={theme.greeting_message}
                buttonStyle={theme.button_style}
                onOpen={openThread}
              />
            )}
            {view === "thread" && openConvId && (
              <ThreadPanel
                conversationId={openConvId}
                fetcher={fetcher}
                self={claims.sub}
                theme={theme}
                onBack={backToList}
              />
            )}
          </div>
        </div>
      )}

      {view === "closed" && (
        <button
          type="button"
          onClick={openList}
          aria-label="Open support inbox"
          className="pointer-events-auto h-14 w-14 mb-3 mr-3 text-white shadow-2xl flex items-center justify-center hover:scale-105 transition-transform"
          style={{
            background: "var(--hl-primary)",
            borderRadius: launcherShape(theme.roundness),
          }}
        >
          {theme.launcher_icon_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={theme.launcher_icon_url}
              alt=""
              width={24}
              height={24}
              className="h-6 w-6 object-contain"
            />
          ) : (
            renderLauncherIcon(theme.launcher_icon_preset, "h-6 w-6")
          )}
        </button>
      )}
    </div>
  );
}

function launcherShape(r: WidgetTheme["roundness"]): string {
  if (r === "sharp") return "6px";
  if (r === "pill") return "9999px";
  return "18px";
}

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return `rgba(15, 23, 42, ${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
