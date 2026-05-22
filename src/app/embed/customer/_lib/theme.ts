import { hexToRgbA } from "./color";

export type Roundness = "sharp" | "rounded" | "pill";
export type ButtonStyle = "solid" | "outline" | "ghost";
export type BubbleStyle = "rounded" | "square" | "tail";

export type WidgetTheme = {
  primary_color: string;
  roundness: Roundness;
  button_style: ButtonStyle;
  bubble_style: BubbleStyle;
  launcher_icon_url: string | null;
  launcher_icon_preset: string | null;
  greeting_message: string | null;
};

export const WIDGET_DEFAULTS: WidgetTheme = {
  primary_color: "#0F172A",
  roundness: "rounded",
  button_style: "solid",
  bubble_style: "rounded",
  launcher_icon_url: null,
  launcher_icon_preset: "message-circle",
  greeting_message: null,
};

/** Translate `roundness` to a concrete border-radius. The pill mode is
 *  intentionally extreme — buttons go full-pill, bubbles cap to a
 *  smaller value in the bubble style helper. */
export function roundnessToRadius(r: Roundness): string {
  if (r === "sharp") return "2px";
  if (r === "pill") return "9999px";
  return "12px";
}

/** Smaller radius for the chat panel chrome — a giant pill panel
 *  doesn't visually parse. We clamp to 20px when `roundness === "pill"`. */
export function panelRadius(r: Roundness): string {
  if (r === "sharp") return "4px";
  if (r === "pill") return "20px";
  return "16px";
}

/** The translucent hover/active tint derived from the primary color. */
export function primaryTint(hex: string, alpha = 0.12): string {
  return hexToRgbA(hex, alpha);
}

/** Inline styles for each button variant. Centralised here so the
 *  composer's send button, the topic picker tiles, and the
 *  "+ New conversation" button stay in lockstep. */
export function buttonStyles(
  variant: ButtonStyle,
  color: string,
  radius: string,
): React.CSSProperties {
  switch (variant) {
    case "outline":
      return {
        background: "transparent",
        color,
        border: `1px solid ${color}`,
        borderRadius: radius,
      };
    case "ghost":
      return {
        background: primaryTint(color, 0.12),
        color,
        border: "1px solid transparent",
        borderRadius: radius,
      };
    case "solid":
    default:
      return {
        background: color,
        color: "#ffffff",
        border: "1px solid transparent",
        borderRadius: radius,
      };
  }
}

/** Inline style for an outbound (customer) message bubble. Tail mode
 *  reuses the rounded radius and overlays a tiny SVG triangle inline
 *  via a sibling element — handled by ThreadMessages. */
export function bubbleStyles(
  variant: BubbleStyle,
  color: string,
  radius: string,
): React.CSSProperties {
  if (variant === "square") {
    return { background: color, color: "#ffffff", borderRadius: "2px" };
  }
  return { background: color, color: "#ffffff", borderRadius: radius };
}
