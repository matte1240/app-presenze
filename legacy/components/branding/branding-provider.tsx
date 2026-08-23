"use client";

import { createContext, useContext } from "react";
import type { PublicBranding } from "@/types/branding";
import { staticBranding } from "@/branding";

/**
 * Carries the branding resolved on the server (including BRAND_* environment
 * overrides) down to client components.
 *
 * The default value is the statically declared branding, so components still
 * render sensibly if they end up outside the provider.
 */
const BrandingContext = createContext<PublicBranding>({
  app: staticBranding.app,
  company: staticBranding.company,
  logo: staticBranding.logo,
});

export function BrandingProvider({
  branding,
  children,
}: {
  branding: PublicBranding;
  children: React.ReactNode;
}) {
  return (
    <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>
  );
}

export function useBranding(): PublicBranding {
  return useContext(BrandingContext);
}
