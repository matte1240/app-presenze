import type { BrandingConfig, BrandingOverrides } from "@/types/branding";
import { neutralPreset } from "@/branding/presets/neutral";
import brandingOverrides from "@/branding.config";

/**
 * Merge branding overrides onto a full config.
 *
 * The shape is fixed and shallow-per-section, so an explicit section-by-section
 * merge is clearer (and safer with `null` values, which are meaningful here)
 * than a generic deep merge.
 */
export function mergeBranding(
  base: BrandingConfig,
  overrides: BrandingOverrides | undefined
): BrandingConfig {
  if (!overrides) return base;

  return {
    app: { ...base.app, ...overrides.app },
    company: { ...base.company, ...overrides.company },
    logo: { ...base.logo, ...overrides.logo },
    icons: { ...base.icons, ...overrides.icons },
    theme: {
      radius: overrides.theme?.radius ?? base.theme.radius,
      light: { ...base.theme.light, ...overrides.theme?.light },
      dark: { ...base.theme.dark, ...overrides.theme?.dark },
    },
    pwa: { ...base.pwa, ...overrides.pwa },
    email: { ...base.email, ...overrides.email },
    regional: { ...base.regional, ...overrides.regional },
  };
}

/**
 * Branding as declared in code: the neutral baseline with `branding.config.ts`
 * merged on top. Contains no environment lookups, so it is safe to import from
 * client components and from modules shared between server and browser.
 *
 * Server code should prefer `getBranding()` from `lib/branding.ts`, which also
 * applies the BRAND_* environment overrides.
 */
export const staticBranding: BrandingConfig = mergeBranding(
  neutralPreset,
  brandingOverrides
);
