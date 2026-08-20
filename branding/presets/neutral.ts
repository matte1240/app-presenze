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
    radius: "0.75rem",
    light: {
      background: "210 40% 98%",
      foreground: "222.2 84% 4.9%",
      card: "0 0% 100%",
      cardForeground: "222.2 84% 4.9%",
      popover: "0 0% 100%",
      popoverForeground: "222.2 84% 4.9%",
      primary: "221.2 83.2% 53.3%",
      primaryForeground: "210 40% 98%",
      secondary: "210 40% 96.1%",
      secondaryForeground: "222.2 47.4% 11.2%",
      muted: "210 40% 96.1%",
      mutedForeground: "215.4 16.3% 46.9%",
      accent: "210 40% 96.1%",
      accentForeground: "222.2 47.4% 11.2%",
      destructive: "0 84.2% 60.2%",
      destructiveForeground: "210 40% 98%",
      border: "214.3 31.8% 91.4%",
      input: "214.3 31.8% 91.4%",
      ring: "221.2 83.2% 53.3%",
      chart1: "221.2 83.2% 53.3%",
      chart2: "173 58% 39%",
      chart3: "197 37% 24%",
      chart4: "43 74% 66%",
      chart5: "27 87% 67%",
    },
    dark: {
      background: "222.2 84% 4.9%",
      foreground: "210 40% 98%",
      card: "222.2 84% 4.9%",
      cardForeground: "210 40% 98%",
      popover: "222.2 84% 4.9%",
      popoverForeground: "210 40% 98%",
      primary: "217.2 91.2% 59.8%",
      primaryForeground: "222.2 47.4% 11.2%",
      secondary: "217.2 32.6% 17.5%",
      secondaryForeground: "210 40% 98%",
      muted: "217.2 32.6% 17.5%",
      mutedForeground: "215 20.2% 65.1%",
      accent: "217.2 32.6% 17.5%",
      accentForeground: "210 40% 98%",
      destructive: "0 62.8% 30.6%",
      destructiveForeground: "210 40% 98%",
      border: "217.2 32.6% 17.5%",
      input: "217.2 32.6% 17.5%",
      ring: "224.3 76.3% 48%",
      chart1: "220 70% 50%",
      chart2: "160 60% 45%",
      chart3: "30 80% 55%",
      chart4: "280 65% 60%",
      chart5: "340 75% 55%",
    },
  },

  pwa: {
    themeColorLight: "#f8fafc",
    themeColorDark: "#0f172a",
    backgroundColor: "#f8fafc",
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
