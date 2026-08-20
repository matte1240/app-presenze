import type { MetadataRoute } from "next";
import { getBranding } from "@/lib/branding";

// Resolved per request so BRAND_* environment overrides apply without a rebuild.
export const dynamic = "force-dynamic";

/**
 * PWA manifest, generated from the branding configuration.
 *
 * Replaces the old static `public/manifest.json`, which hardcoded one
 * customer's name, colors and icons.
 */
export default function manifest(): MetadataRoute.Manifest {
  const { app, icons, pwa } = getBranding();

  // Each icon is declared twice: `any` for the raw artwork and `maskable` so
  // Android can crop it into the platform's icon shape.
  const expand = (list: typeof icons.pwa) =>
    list.flatMap((icon) => [
      { src: icon.src, sizes: icon.sizes, type: icon.type ?? "image/png", purpose: "any" as const },
      { src: icon.src, sizes: icon.sizes, type: icon.type ?? "image/png", purpose: "maskable" as const },
    ]);

  const manifestEntry: MetadataRoute.Manifest = {
    name: app.name,
    short_name: app.shortName,
    description: app.description,
    start_url: "/",
    id: "/",
    display: pwa.display,
    display_override: [pwa.display],
    background_color: pwa.backgroundColor,
    theme_color: pwa.themeColorDark,
    orientation: pwa.orientation,
    icons: expand(icons.pwa),
  };

  // `dark_icons` is not part of Next's Manifest type yet, but browsers that
  // support it will pick the dark-background artwork.
  const darkIcons = icons.pwaDark.length > 0 ? expand(icons.pwaDark) : undefined;
  if (darkIcons) {
    (manifestEntry as MetadataRoute.Manifest & { dark_icons?: unknown }).dark_icons =
      darkIcons;
  }

  return manifestEntry;
}
