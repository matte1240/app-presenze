import type { BrandingConfig } from "@/types/branding";

/**
 * Neutral baseline — the product as it ships, before any customer branding.
 *
 * Every other preset — and `branding.config.ts` — is merged on top of this, so
 * a customer only has to declare what actually differs. On its own it produces
 * a clean, generic product with a generated text wordmark and no customer marks.
 */
export const neutralPreset: BrandingConfig = {
  app: {
    name: "Presenze",
    shortName: "Presenze",
    description: "Gestione presenze, orari e richieste di assenza",
    tagline: "Gestione Presenze e Orari",
    subtitle:
      "Traccia le tue attività giornaliere, gestisci il tuo tempo in modo efficiente e mantieni il team sincronizzato con il nostro sistema intuitivo.",
    locale: "it-IT",
    htmlLang: "it",
  },

  company: {
    name: "Presenze",
    website: null,
    supportEmail: null,
  },

  logo: {
    // No customer wordmark by default: the Logo component renders a text
    // wordmark built from `app.name` until real assets are configured.
    light: null,
    dark: null,
    alt: null,
    width: 257,
    height: 52,
    icon: "/branding/mark.svg",
    emailLight: "branding/email-logo.png",
    emailDark: "branding/email-logo-white.png",
    emailWidth: 96,
  },

  icons: {
    favicon: "/branding/favicon.png",
    faviconDark: "/branding/favicon-dark.png",
    appleTouchIcon: "/branding/apple-touch-icon.png",
    pwa: [
      { src: "/branding/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/branding/icon-256.png", sizes: "256x256", type: "image/png" },
      { src: "/branding/icon-384.png", sizes: "384x384", type: "image/png" },
      { src: "/branding/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    pwaDark: [
      { src: "/branding/icon-192-dark.png", sizes: "192x192", type: "image/png" },
      { src: "/branding/icon-256-dark.png", sizes: "256x256", type: "image/png" },
      { src: "/branding/icon-384-dark.png", sizes: "384x384", type: "image/png" },
      { src: "/branding/icon-512-dark.png", sizes: "512x512", type: "image/png" },
    ],
  },

  theme: {
    // 10px: soft enough to read as modern, tight enough to stay precise.
    radius: "0.625rem",

    // Near-neutral cool greys with a single chromatic accent. The palette is
    // deliberately low-chroma so a customer's primary colour — the one thing
    // most deployments override — is the only saturated element on screen.
    light: {
      background: "240 9% 98%",
      foreground: "240 10% 8%",
      card: "0 0% 100%",
      cardForeground: "240 10% 8%",
      popover: "0 0% 100%",
      popoverForeground: "240 10% 8%",
      primary: "243 72% 58%",
      primaryForeground: "0 0% 100%",
      secondary: "240 6% 96%",
      secondaryForeground: "240 9% 14%",
      muted: "240 6% 96%",
      mutedForeground: "240 4% 46%",
      accent: "240 6% 95%",
      accentForeground: "240 9% 14%",
      destructive: "0 72% 51%",
      destructiveForeground: "0 0% 100%",
      border: "240 6% 90%",
      input: "240 6% 90%",
      ring: "243 72% 58%",
      chart1: "243 72% 58%",
      chart2: "173 60% 40%",
      chart3: "35 92% 55%",
      chart4: "340 75% 55%",
      chart5: "199 89% 48%",
    },
    dark: {
      // The card sits above the background rather than matching it, so panels
      // read as surfaces instead of dissolving into a flat sheet of black.
      background: "240 10% 4%",
      foreground: "240 6% 96%",
      card: "240 8% 7%",
      cardForeground: "240 6% 96%",
      popover: "240 8% 8%",
      popoverForeground: "240 6% 96%",
      primary: "243 75% 68%",
      primaryForeground: "240 10% 6%",
      secondary: "240 6% 13%",
      secondaryForeground: "240 6% 96%",
      muted: "240 6% 13%",
      mutedForeground: "240 5% 60%",
      accent: "240 6% 15%",
      accentForeground: "240 6% 96%",
      destructive: "0 72% 58%",
      destructiveForeground: "0 0% 100%",
      border: "240 6% 16%",
      input: "240 6% 18%",
      ring: "243 75% 68%",
      chart1: "243 75% 68%",
      chart2: "173 58% 48%",
      chart3: "35 92% 62%",
      chart4: "340 75% 65%",
      chart5: "199 89% 58%",
    },
  },

  pwa: {
    themeColorLight: "#f9f9fa",
    themeColorDark: "#0a0a0b",
    backgroundColor: "#f9f9fa",
    display: "standalone",
    orientation: "portrait-primary",
  },

  email: {
    primary: "#059669",
    success: "#059669",
    warning: "#d97706",
    danger: "#dc2626",
    info: "#3b82f6",
  },

  regional: {
    holidayCountry: "IT",
    holidayState: null,
    holidayRegion: null,
    timezone: "Europe/Rome",
  },
};
