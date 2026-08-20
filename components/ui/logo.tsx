"use client";

/*
 * Branded logos are arbitrary customer assets — most often SVG — served from
 * /public at a fixed rendered size. next/image adds no optimization for them
 * and would need per-customer remotePatterns config, so plain <img> is right
 * here.
 */
/* eslint-disable @next/next/no-img-element */

import { useBranding } from "@/components/branding/branding-provider";

/**
 * Brand wordmark.
 *
 * Renders the configured logo assets when `logo.light` is set (with a separate
 * dark-mode asset when `logo.dark` is provided), and otherwise falls back to a
 * generated wordmark built from the application name — so a fresh deployment
 * looks finished before any artwork exists.
 *
 * Configure it in `branding.config.ts` or via BRAND_LOGO_* environment
 * variables. Assets must be served from `/public` to satisfy the app's CSP.
 */
export function Logo({ className }: { className?: string }) {
  const { app, logo } = useBranding();
  const alt = logo.alt ?? app.name;

  if (!logo.light) {
    return <WordmarkFallback name={app.name} className={className} />;
  }

  const darkSrc = logo.dark ?? logo.light;
  const hasDarkVariant = darkSrc !== logo.light;

  if (!hasDarkVariant) {
    return (
      <img
        src={logo.light}
        alt={alt}
        width={logo.width}
        height={logo.height}
        className={className}
      />
    );
  }

  return (
    <>
      <img
        src={logo.light}
        alt={alt}
        width={logo.width}
        height={logo.height}
        className={`dark:hidden ${className ?? ""}`}
      />
      <img
        src={darkSrc}
        alt={alt}
        width={logo.width}
        height={logo.height}
        className={`hidden dark:block ${className ?? ""}`}
      />
    </>
  );
}

/**
 * Text wordmark used when no logo asset is configured. It is an SVG so it
 * scales with the same `h-*` utility classes the image variants use, and it
 * picks up the current theme through `currentColor` and the primary token.
 */
function WordmarkFallback({ name, className }: { name: string; className?: string }) {
  const initials = getInitials(name);
  const badgeWidth = 52;
  const gap = 12;
  const nameWidth = Math.ceil(measureEm(name) * NAME_FONT_SIZE);
  const width = badgeWidth + gap + nameWidth;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${width} 52`}
      preserveAspectRatio="xMinYMid meet"
      className={`text-foreground ${className ?? ""}`}
      role="img"
      aria-label={name}
    >
      <rect
        x="0"
        y="0"
        width={badgeWidth}
        height="52"
        rx="12"
        fill="hsl(var(--primary))"
      />
      <text
        x={badgeWidth / 2}
        y="27"
        textAnchor="middle"
        dominantBaseline="central"
        fill="hsl(var(--primary-foreground))"
        fontSize="24"
        fontWeight="700"
        fontFamily="var(--font-sans, system-ui), sans-serif"
      >
        {initials}
      </text>
      <text
        x={badgeWidth + gap}
        y="27"
        dominantBaseline="central"
        fill="currentColor"
        fontSize={NAME_FONT_SIZE}
        fontWeight="600"
        fontFamily="var(--font-sans, system-ui), sans-serif"
        textLength={nameWidth}
        lengthAdjust="spacing"
      >
        {name}
      </text>
    </svg>
  );
}

const NAME_FONT_SIZE = 32;

/**
 * Per-character advance widths, in em, for the app's sans stack at weight 600.
 *
 * A uniform per-character estimate cannot work: measured against the real font,
 * advances range from ~0.33em ("l") to ~1.09em ("W"), so any single average
 * clips wide names or leaves a gap after narrow ones. These buckets were
 * calibrated against the browser's own `getComputedTextLength()` and land
 * within ~2% on realistic brand names.
 */
const WIDE_CHARS = "WM@%";
const SEMI_WIDE_CHARS = "mw";
const NARROW_CHARS = "iljtfrI.,:;!|'\"()[]";
const DEFAULT_WIDTH_EM = 0.64;
const CHAR_WIDTH_EM: Record<string, number> = {
  wide: 1.15,
  semiWide: 1.0,
  upper: 0.8,
  narrow: 0.36,
  space: 0.31,
  digit: 0.69,
};

/**
 * Width of `text` in em at the wordmark's weight.
 *
 * The result only reserves the box: `textLength` on the `<text>` element
 * absorbs any residual error as letter spacing, so a substituted or not-yet
 * loaded font shifts tracking slightly instead of clipping the name.
 */
function measureEm(text: string): number {
  let total = 0;

  for (const char of text) {
    if (char === " ") total += CHAR_WIDTH_EM.space;
    else if (WIDE_CHARS.includes(char)) total += CHAR_WIDTH_EM.wide;
    else if (SEMI_WIDE_CHARS.includes(char)) total += CHAR_WIDTH_EM.semiWide;
    else if (NARROW_CHARS.includes(char)) total += CHAR_WIDTH_EM.narrow;
    else if (char >= "0" && char <= "9") total += CHAR_WIDTH_EM.digit;
    else if (char === char.toUpperCase() && char !== char.toLowerCase()) {
      total += CHAR_WIDTH_EM.upper;
    } else total += DEFAULT_WIDTH_EM;
  }

  return total;
}

/** First letters of the first two words, e.g. "Presenze Acme" → "PA". */
function getInitials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");

  return letters || "?";
}
