import type {
  BrandingConfig,
  BrandingIcon,
  PublicBranding,
  ThemeTokens,
} from "@/types/branding";
import { staticBranding } from "@/branding";
import { hexToHslToken, readableForegroundToken } from "@/lib/utils/color-utils";

/**
 * Server-side branding resolver.
 *
 * Resolution order: neutral preset → `branding.config.ts` → BRAND_* env vars.
 * Because the environment layer is read at request time, a single Docker image
 * can be rebranded per deployment without a rebuild.
 *
 * Client components must not import this module — they receive the public
 * subset through `BrandingProvider` / `useBranding()`.
 */

let cached: BrandingConfig | null = null;

export function getBranding(): BrandingConfig {
  if (cached) return cached;
  cached = applyEnvOverrides(staticBranding);
  return cached;
}

/** Test/HMR escape hatch: drop the memoized config so env changes are picked up. */
export function resetBrandingCache(): void {
  cached = null;
}

/** The subset of branding that is safe to serialize to the browser. */
export function getPublicBranding(): PublicBranding {
  const branding = getBranding();
  return {
    app: branding.app,
    company: branding.company,
    logo: branding.logo,
  };
}

// ---------------------------------------------------------------------------
// Theme CSS
// ---------------------------------------------------------------------------

const TOKEN_VARIABLES: Array<[keyof ThemeTokens, string]> = [
  ["background", "--background"],
  ["foreground", "--foreground"],
  ["card", "--card"],
  ["cardForeground", "--card-foreground"],
  ["popover", "--popover"],
  ["popoverForeground", "--popover-foreground"],
  ["primary", "--primary"],
  ["primaryForeground", "--primary-foreground"],
  ["secondary", "--secondary"],
  ["secondaryForeground", "--secondary-foreground"],
  ["muted", "--muted"],
  ["mutedForeground", "--muted-foreground"],
  ["accent", "--accent"],
  ["accentForeground", "--accent-foreground"],
  ["destructive", "--destructive"],
  ["destructiveForeground", "--destructive-foreground"],
  ["border", "--border"],
  ["input", "--input"],
  ["ring", "--ring"],
  ["chart1", "--chart-1"],
  ["chart2", "--chart-2"],
  ["chart3", "--chart-3"],
  ["chart4", "--chart-4"],
  ["chart5", "--chart-5"],
];

/**
 * Render the branded design tokens as a stylesheet injected into <head>.
 *
 * Selectors are deliberately more specific than the `:root` / `.dark` rules in
 * `globals.css` so the branded palette wins regardless of stylesheet order,
 * while `globals.css` still provides a working fallback.
 */
export function buildThemeCss(branding: BrandingConfig = getBranding()): string {
  const light = TOKEN_VARIABLES.map(
    ([token, variable]) => `${variable}:${branding.theme.light[token]};`
  ).join("");
  const dark = TOKEN_VARIABLES.map(
    ([token, variable]) => `${variable}:${branding.theme.dark[token]};`
  ).join("");

  return (
    `html:root{${light}--radius:${branding.theme.radius};}` +
    `html:root.dark{${dark}}`
  );
}

// ---------------------------------------------------------------------------
// Email branding
// ---------------------------------------------------------------------------

export type EmailBranding = {
  appName: string;
  companyName: string;
  supportEmail: string | null;
  logoWidth: number;
  /** `cid:` reference for the logo on the colored header band. */
  logoDarkCid: string;
  /** `cid:` reference for the logo on white backgrounds. */
  logoLightCid: string;
  colors: BrandingConfig["email"];
  year: number;
};

/** Convenience view of the branding used by the transactional email templates. */
export function getEmailBranding(): EmailBranding {
  const branding = getBranding();
  return {
    appName: branding.app.name,
    companyName: branding.company.name,
    supportEmail: branding.company.supportEmail,
    logoWidth: branding.logo.emailWidth,
    logoDarkCid: "logo-white",
    logoLightCid: "logo",
    colors: branding.email,
    year: new Date().getFullYear(),
  };
}

// ---------------------------------------------------------------------------
// Environment overrides
// ---------------------------------------------------------------------------

function applyEnvOverrides(base: BrandingConfig): BrandingConfig {
  const next: BrandingConfig = {
    app: { ...base.app },
    company: { ...base.company },
    logo: { ...base.logo },
    icons: {
      ...base.icons,
      pwa: [...base.icons.pwa],
      pwaDark: [...base.icons.pwaDark],
    },
    theme: {
      radius: base.theme.radius,
      light: { ...base.theme.light },
      dark: { ...base.theme.dark },
    },
    pwa: { ...base.pwa },
    email: { ...base.email },
    regional: { ...base.regional },
  };

  // App identity
  next.app.name = str("BRAND_APP_NAME") ?? next.app.name;
  next.app.shortName = str("BRAND_APP_SHORT_NAME") ?? next.app.shortName;
  next.app.description = str("BRAND_APP_DESCRIPTION") ?? next.app.description;
  next.app.tagline = str("BRAND_APP_TAGLINE") ?? next.app.tagline;
  next.app.subtitle = str("BRAND_APP_SUBTITLE") ?? next.app.subtitle;
  next.app.locale = str("BRAND_LOCALE") ?? next.app.locale;
  next.app.htmlLang = str("BRAND_HTML_LANG") ?? next.app.htmlLang;

  // Company
  next.company.name = str("BRAND_COMPANY_NAME") ?? next.company.name;
  next.company.website = nullableStr("BRAND_COMPANY_WEBSITE", next.company.website);
  next.company.supportEmail = nullableStr("BRAND_SUPPORT_EMAIL", next.company.supportEmail);

  // Logo
  next.logo.light = nullableStr("BRAND_LOGO_LIGHT", next.logo.light);
  next.logo.dark = nullableStr("BRAND_LOGO_DARK", next.logo.dark);
  next.logo.icon = nullableStr("BRAND_LOGO_ICON", next.logo.icon);
  next.logo.alt = nullableStr("BRAND_LOGO_ALT", next.logo.alt);
  next.logo.width = num("BRAND_LOGO_WIDTH") ?? next.logo.width;
  next.logo.height = num("BRAND_LOGO_HEIGHT") ?? next.logo.height;
  next.logo.emailLight = str("BRAND_EMAIL_LOGO_LIGHT") ?? next.logo.emailLight;
  next.logo.emailDark = str("BRAND_EMAIL_LOGO_DARK") ?? next.logo.emailDark;
  next.logo.emailWidth = num("BRAND_EMAIL_LOGO_WIDTH") ?? next.logo.emailWidth;

  // Icons
  next.icons.favicon = str("BRAND_FAVICON") ?? next.icons.favicon;
  next.icons.faviconDark = str("BRAND_FAVICON_DARK") ?? next.icons.faviconDark;
  next.icons.appleTouchIcon = str("BRAND_APPLE_TOUCH_ICON") ?? next.icons.appleTouchIcon;
  next.icons.pwa = iconList("BRAND_PWA_ICONS") ?? next.icons.pwa;
  next.icons.pwaDark = iconList("BRAND_PWA_ICONS_DARK") ?? next.icons.pwaDark;

  // Theme — full-palette JSON overrides first, then the single-color shortcuts.
  next.theme.radius = str("BRAND_RADIUS") ?? next.theme.radius;
  Object.assign(next.theme.light, tokenJson("BRAND_THEME_LIGHT"));
  Object.assign(next.theme.dark, tokenJson("BRAND_THEME_DARK"));
  applyPrimaryColor(next.theme.light, str("BRAND_PRIMARY_COLOR"));
  applyPrimaryColor(
    next.theme.dark,
    str("BRAND_PRIMARY_COLOR_DARK") ?? str("BRAND_PRIMARY_COLOR")
  );

  // PWA
  next.pwa.themeColorLight = str("BRAND_PWA_THEME_COLOR_LIGHT") ?? next.pwa.themeColorLight;
  next.pwa.themeColorDark = str("BRAND_PWA_THEME_COLOR_DARK") ?? next.pwa.themeColorDark;
  next.pwa.backgroundColor = str("BRAND_PWA_BACKGROUND_COLOR") ?? next.pwa.backgroundColor;

  // Email palette
  next.email.primary = str("BRAND_EMAIL_COLOR_PRIMARY") ?? next.email.primary;
  next.email.success = str("BRAND_EMAIL_COLOR_SUCCESS") ?? next.email.success;
  next.email.warning = str("BRAND_EMAIL_COLOR_WARNING") ?? next.email.warning;
  next.email.danger = str("BRAND_EMAIL_COLOR_DANGER") ?? next.email.danger;
  next.email.info = str("BRAND_EMAIL_COLOR_INFO") ?? next.email.info;

  // Regional.
  //
  // The holiday calendar is computed on both the server and the client, so it
  // must resolve identically in both — a runtime-only override would desync the
  // two and break hydration. It is therefore configured in `branding.config.ts`
  // or through NEXT_PUBLIC_BRAND_HOLIDAY_COUNTRY, which is inlined at build time.
  next.regional.holidayCountry =
    str("NEXT_PUBLIC_BRAND_HOLIDAY_COUNTRY") ?? next.regional.holidayCountry;
  next.regional.timezone = str("TZ") ?? next.regional.timezone;

  return next;
}

/**
 * Derive `--primary`, its foreground and `--ring` from a single brand hex color.
 * Invalid values are ignored so a typo degrades to the configured palette
 * instead of producing an unreadable interface.
 */
function applyPrimaryColor(tokens: ThemeTokens, hex: string | undefined): void {
  if (!hex) return;

  const primary = hexToHslToken(hex);
  if (!primary) {
    console.warn(`⚠️ Branding: ignoring invalid BRAND_PRIMARY_COLOR value "${hex}"`);
    return;
  }

  const foreground = readableForegroundToken(hex);
  tokens.primary = primary;
  tokens.ring = primary;
  if (foreground) tokens.primaryForeground = foreground;
}

function str(key: string): string | undefined {
  const value = process.env[key];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** Like `str`, but the literal value `none` clears an optional setting. */
function nullableStr(key: string, fallback: string | null): string | null {
  const value = str(key);
  if (value === undefined) return fallback;
  return value.toLowerCase() === "none" ? null : value;
}

function num(key: string): number | undefined {
  const value = str(key);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function tokenJson(key: string): Partial<ThemeTokens> {
  const value = str(key);
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as Partial<ThemeTokens>;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    console.warn(`⚠️ Branding: ${key} is not valid JSON, ignoring it`);
    return {};
  }
}

function iconList(key: string): BrandingIcon[] | undefined {
  const value = str(key);
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) throw new Error("expected an array");
    return parsed.filter(
      (icon): icon is BrandingIcon =>
        typeof icon?.src === "string" && typeof icon?.sizes === "string"
    );
  } catch {
    console.warn(`⚠️ Branding: ${key} is not a valid icon array, ignoring it`);
    return undefined;
  }
}
