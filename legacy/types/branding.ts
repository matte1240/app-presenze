/**
 * White-label branding contract.
 *
 * Everything visually or textually tied to a specific customer lives here.
 * Edit `branding.config.ts` (or set BRAND_* environment variables) to rebrand
 * the whole application — no component changes required.
 */

/** Tailwind/shadcn design tokens. Values are raw HSL triplets: `"221.2 83.2% 53.3%"`. */
export type ThemeTokens = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
};

/** Colors used by the transactional email templates (inline hex, no CSS variables in email). */
export type EmailPalette = {
  /** Header band + primary call-to-action button. */
  primary: string;
  /** Positive states: approvals, successful backups. */
  success: string;
  /** Warning states: reminders, expiring links. */
  warning: string;
  /** Negative states: rejections, failed backups. */
  danger: string;
  /** Informational callout boxes. */
  info: string;
};

export type BrandingIcon = {
  src: string;
  sizes: string;
  type?: string;
};

export type AppBranding = {
  /** Full product name: page titles, email subjects, PWA name. */
  name: string;
  /** Short name for the PWA home-screen label (keep under ~12 chars). */
  shortName: string;
  /** Meta description and PWA description. */
  description: string;
  /** Hero headline on the login page. */
  tagline: string;
  /** Hero paragraph under the headline on the login page. */
  subtitle: string;
  /** BCP-47 locale used for date/number formatting. */
  locale: string;
  /** `lang` attribute on <html>. */
  htmlLang: string;
};

export type CompanyBranding = {
  /** Display name used in the footer and email signatures. */
  name: string;
  /** Optional public website, linked from the login footer when set. */
  website: string | null;
  /** Address shown to users who need help. */
  supportEmail: string | null;
};

export type LogoBranding = {
  /**
   * Wordmark shown on light backgrounds. Path under /public or absolute URL.
   * Set to `null` to fall back to a generated text wordmark built from `app.name`.
   */
  light: string | null;
  /** Wordmark shown on dark backgrounds. Falls back to `light` when null. */
  dark: string | null;
  /** Square mark used for the wordmark fallback badge and as icon-generation source. */
  icon: string | null;
  /** Alt text for the wordmark. Defaults to `app.name` when null. */
  alt: string | null;
  /** Rendered wordmark aspect ratio, used to reserve layout space. */
  width: number;
  height: number;
  /** Logo file (under /public) embedded in emails on light backgrounds. */
  emailLight: string;
  /** Logo file (under /public) embedded in emails on the colored header band. */
  emailDark: string;
  /** Rendered width of the email logo, in px. */
  emailWidth: number;
};

export type IconBranding = {
  favicon: string;
  faviconDark: string;
  appleTouchIcon: string;
  /** PWA icons used on light backgrounds. */
  pwa: BrandingIcon[];
  /** PWA icons used on dark backgrounds. Falls back to `pwa` when empty. */
  pwaDark: BrandingIcon[];
};

export type ThemeBranding = {
  /** Global corner radius, e.g. `"0.75rem"`. */
  radius: string;
  light: ThemeTokens;
  dark: ThemeTokens;
};

export type PwaBranding = {
  themeColorLight: string;
  themeColorDark: string;
  backgroundColor: string;
  display: "standalone" | "fullscreen" | "minimal-ui" | "browser";
  orientation: "any" | "portrait" | "portrait-primary" | "landscape";
};

export type RegionalBranding = {
  /** ISO 3166-1 alpha-2 country used for the public-holiday calendar, e.g. `"IT"`. */
  holidayCountry: string;
  /** Optional state/province for country-specific holiday sets. */
  holidayState: string | null;
  /** Optional region for country-specific holiday sets. */
  holidayRegion: string | null;
  /** IANA timezone used for scheduled jobs and date rendering. */
  timezone: string;
};

export type BrandingConfig = {
  app: AppBranding;
  company: CompanyBranding;
  logo: LogoBranding;
  icons: IconBranding;
  theme: ThemeBranding;
  pwa: PwaBranding;
  email: EmailPalette;
  regional: RegionalBranding;
};

/** Deep-partial shape accepted by `branding.config.ts` and by presets. */
export type BrandingOverrides = {
  app?: Partial<AppBranding>;
  company?: Partial<CompanyBranding>;
  logo?: Partial<LogoBranding>;
  icons?: Partial<IconBranding>;
  theme?: {
    radius?: string;
    light?: Partial<ThemeTokens>;
    dark?: Partial<ThemeTokens>;
  };
  pwa?: Partial<PwaBranding>;
  email?: Partial<EmailPalette>;
  regional?: Partial<RegionalBranding>;
};

/**
 * Subset of the branding that is safe to ship to the browser and is consumed by
 * client components through the branding context.
 */
export type PublicBranding = {
  app: AppBranding;
  company: CompanyBranding;
  logo: LogoBranding;
};
