/**
 * Tiny color helpers for the embed surface. Prompt 5 will land the
 * full `widget_config` consumer; until then, callers pass the primary
 * color through directly (a hex string) and we synthesize a translucent
 * hover/active background from it.
 */

export function hexToRgbA(hex: string, alpha: number): string {
  const parsed = parseHex(hex);
  if (!parsed) return `rgba(15, 23, 42, ${alpha})`;
  const { r, g, b } = parsed;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function parseHex(raw: string): { r: number; g: number; b: number } | null {
  const hex = raw.trim().replace(/^#/, "");
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return null;
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  const num = parseInt(full, 16);
  return {
    r: (num >> 16) & 0xff,
    g: (num >> 8) & 0xff,
    b: num & 0xff,
  };
}
