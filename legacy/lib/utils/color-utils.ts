/**
 * Color helpers for the white-label theming system.
 *
 * Design tokens are stored as raw HSL triplets (`"221.2 83.2% 53.3%"`) so they
 * can be dropped straight into `hsl(var(--token))`. Customers, however, hand
 * over brand colors as hex, so we convert on the way in.
 */

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

type Rgb = { r: number; g: number; b: number };

/** Parse `#abc` / `#aabbcc` (with or without `#`) into 0-255 channels. */
export function parseHex(hex: string): Rgb | null {
  const match = HEX_RE.exec(hex.trim());
  if (!match) return null;

  let value = match[1];
  if (value.length === 3) {
    value = value
      .split("")
      .map((c) => c + c)
      .join("");
  }

  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

/**
 * Convert a hex color to the raw HSL triplet used by the design tokens.
 * Returns null when the input is not a valid hex color, so callers can keep
 * their existing token instead of rendering a broken theme.
 */
export function hexToHslToken(hex: string): string | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;

  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;

  let hue = 0;
  let saturation = 0;

  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));

    if (max === r) {
      hue = ((g - b) / delta) % 6;
    } else if (max === g) {
      hue = (b - r) / delta + 2;
    } else {
      hue = (r - g) / delta + 4;
    }

    hue *= 60;
    if (hue < 0) hue += 360;
  }

  return `${round(hue)} ${round(saturation * 100)}% ${round(lightness * 100)}%`;
}

/**
 * Relative luminance per WCAG 2.1, used to decide whether text on top of a
 * brand color should be near-white or near-black.
 */
export function relativeLuminance(hex: string): number | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;

  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };

  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/**
 * Pick a readable foreground token for a brand color. Threshold 0.5 keeps
 * mid-tone brand colors (the common case) on white text, which reads better
 * against saturated hues than a strict 4.5:1 contrast split would.
 */
export function readableForegroundToken(hex: string): string | null {
  const luminance = relativeLuminance(hex);
  if (luminance === null) return null;
  return luminance > 0.5 ? "222.2 47.4% 11.2%" : "0 0% 100%";
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
