import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import AuthSessionProvider from "@/components/auth/session-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { BrandingProvider } from "@/components/branding/branding-provider";
import { ToastProvider } from "@/components/ui/toast";
import { buildThemeCss, getBranding, getPublicBranding } from "@/lib/branding";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { app, icons } = getBranding();

  return {
    title: app.name,
    description: app.description,
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: app.shortName,
    },
    icons: {
      icon: [
        { url: icons.favicon, media: "(prefers-color-scheme: light)" },
        { url: icons.faviconDark, media: "(prefers-color-scheme: dark)" },
      ],
      apple: [{ url: icons.appleTouchIcon, sizes: "180x180" }],
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const { pwa } = getBranding();

  return {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
    themeColor: [
      { color: pwa.themeColorLight, media: "(prefers-color-scheme: light)" },
      { color: pwa.themeColorDark, media: "(prefers-color-scheme: dark)" },
    ],
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const branding = getBranding();

  return (
    <html lang={branding.app.htmlLang} suppressHydrationWarning>
      <head>
        {/*
          Branded design tokens, resolved at request time so a deployment can be
          rebranded through BRAND_* environment variables without a rebuild.
        */}
        <style
          id="brand-theme"
          dangerouslySetInnerHTML={{ __html: buildThemeCss(branding) }}
        />
      </head>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} min-h-screen bg-background text-foreground antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <BrandingProvider branding={getPublicBranding()}>
            <AuthSessionProvider>
              <ToastProvider>{children}</ToastProvider>
            </AuthSessionProvider>
          </BrandingProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
