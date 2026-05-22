"use client";

import { useMemo } from "react";
import { MessageCircle, type LucideIcon } from "lucide-react";
import {
  LAUNCHER_ICONS,
  isLauncherIcon,
} from "./launcher-icons";
import { renderGreetingPreview } from "@/lib/widget-greeting-markdown";
import type {
  BubbleStyle,
  ButtonStyle,
  Roundness,
  WidgetConfigInput,
} from "@/app/dashboard/_actions/widget-config";

const SAMPLE_OPTIONS: ReadonlyArray<{ label: string; Icon: LucideIcon }> = [
  { label: "Talk to support", Icon: MessageCircle },
  { label: "Billing question", Icon: LAUNCHER_ICONS["help-circle"] },
  { label: "Order issue", Icon: LAUNCHER_ICONS["shopping-bag"] },
];

/** A miniature widget panel + launcher rendered from the unsaved form
 *  state. Values track form mutations so owners can compare side-by-
 *  side with the live launcher before clicking Save. */
export function WidgetAppearancePreview({
  state,
  businessName,
}: {
  state: WidgetConfigInput;
  businessName: string;
}) {
  const radius = roundnessToRadius(state.roundness);
  const tint = hexToRgba(state.primary_color, 0.12);
  const greetingHtml = useMemo(
    () => renderGreetingPreview(state.greeting_message ?? ""),
    [state.greeting_message],
  );

  const PresetIcon =
    state.launcher_icon_preset && isLauncherIcon(state.launcher_icon_preset)
      ? LAUNCHER_ICONS[state.launcher_icon_preset]
      : MessageCircle;

  const buttonStyle = buttonInlineStyle(state.button_style, state.primary_color, tint);
  const outboundBubble = bubbleInlineStyle(state.bubble_style, state.primary_color, radius);

  return (
    <aside className="sticky top-6 space-y-3">
      <div className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
        Live preview
      </div>
      <div className="rounded-2xl border border-mist/80 bg-mist/30 p-6">
        <div className="relative mx-auto" style={{ width: 320, height: 420 }}>
          <div
            className="absolute inset-0 bg-white shadow-2xl border border-zinc-200 flex flex-col overflow-hidden"
            style={{ borderRadius: radius === "9999px" ? "20px" : radius }}
          >
            <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 bg-white text-zinc-900">
              <span className="text-sm font-semibold truncate">
                {businessName}
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
            </header>
            <div className="flex-1 px-4 py-4 space-y-3 overflow-hidden">
              {greetingHtml && (
                <div
                  className="text-[13px] text-zinc-900 leading-snug"
                  dangerouslySetInnerHTML={{ __html: greetingHtml }}
                />
              )}
              <div className="flex flex-col gap-2">
                {SAMPLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    style={{ ...buttonStyle, borderRadius: radius }}
                    className="flex items-center gap-2.5 px-3 py-2.5 text-[12px] font-medium text-left"
                  >
                    <opt.Icon className="h-4 w-4" />
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
              <div className="pt-1 flex justify-end">
                <div
                  className="max-w-[70%] text-[12px] px-3 py-1.5 text-white relative"
                  style={outboundBubble}
                >
                  Thanks!
                  {state.bubble_style === "tail" && (
                    <span
                      aria-hidden
                      className="absolute -bottom-1.5 right-2 block h-0 w-0"
                      style={{
                        borderLeft: "6px solid transparent",
                        borderRight: "6px solid transparent",
                        borderTop: `6px solid ${state.primary_color}`,
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="absolute -bottom-2 -right-2">
            <div
              className="h-12 w-12 grid place-items-center shadow-lg"
              style={{
                background: state.primary_color,
                borderRadius: launcherShape(state.roundness),
              }}
            >
              {state.launcher_icon_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={state.launcher_icon_url}
                  alt=""
                  className="h-6 w-6 object-contain"
                />
              ) : (
                <PresetIcon className="h-5 w-5 text-white" />
              )}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function roundnessToRadius(r: Roundness): string {
  if (r === "sharp") return "2px";
  if (r === "pill") return "9999px";
  return "12px";
}

function launcherShape(r: Roundness): string {
  if (r === "sharp") return "4px";
  if (r === "pill") return "9999px";
  return "14px";
}

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return `rgba(15, 23, 42, ${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function buttonInlineStyle(
  style: ButtonStyle,
  color: string,
  tint: string,
): React.CSSProperties {
  switch (style) {
    case "outline":
      return { background: "transparent", color, border: `1px solid ${color}` };
    case "ghost":
      return { background: tint, color, border: "1px solid transparent" };
    case "solid":
    default:
      return { background: color, color: "#ffffff", border: "1px solid transparent" };
  }
}

function bubbleInlineStyle(
  style: BubbleStyle,
  color: string,
  radius: string,
): React.CSSProperties {
  if (style === "square") return { background: color, borderRadius: "2px" };
  return { background: color, borderRadius: radius };
}
