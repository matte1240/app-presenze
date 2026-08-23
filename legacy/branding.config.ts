import type { BrandingOverrides } from "@/types/branding";

/**
 * ============================================================================
 *  BRANDING — start here when you deploy this product for a new customer.
 * ============================================================================
 *
 * The product ships unbranded: an empty object here means every value comes
 * from `branding/presets/neutral.ts`, which renders a neutral placeholder mark
 * and a text wordmark built from the application name. That is a complete,
 * shippable look — fill this file in only to make it the customer's.
 *
 * Anything you declare below is merged on top of the neutral baseline, so you
 * only list what actually differs.
 *
 * Three layers, later wins:
 *
 *   1. `branding/presets/neutral.ts` — the unbranded baseline (do not edit).
 *   2. This file — the customer's brand, committed to their repository.
 *   3. BRAND_* environment variables — per-deployment overrides, applied at
 *      runtime with no rebuild. See `.env.example` and `docs/WHITE_LABEL.md`.
 *
 * A worked example:
 *
 *   const branding: BrandingOverrides = {
 *     app: { name: "Presenze Acme", shortName: "Acme", description: "..." },
 *     company: { name: "Acme S.p.A.", website: "https://acme.example" },
 *     logo: {
 *       light: "/branding/acme-logo-light.svg",
 *       dark: "/branding/acme-logo-dark.svg",
 *       icon: "/branding/acme-mark.svg",
 *     },
 *     theme: { light: { primary: "18 90% 48%" }, dark: { primary: "18 90% 58%" } },
 *   };
 *
 * After swapping the mark, regenerate the favicons and PWA icons:
 *
 *   npm run brand:icons -- --source public/branding/acme-mark.svg
 *   npm run brand:icons -- --source public/branding/acme-mark-white.svg --suffix -dark --background "#0f172a"
 */
const branding: BrandingOverrides = {};

export default branding;
