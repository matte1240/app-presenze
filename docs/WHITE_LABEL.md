# 🎨 White-Label Guide

This product is built to be resold. Every customer-facing element — name, logo,
colors, favicons, PWA identity, email design, holiday calendar — is
configuration, not code. Rebranding a deployment does not require touching a
single component.

---

## The three layers

Branding resolves in this order; each layer overrides the one above it.

| Layer | File / mechanism | Applies at | Use it for |
|-------|------------------|-----------|------------|
| 1. Baseline | `branding/presets/neutral.ts` | build | The unbranded defaults the product ships with. **Don't edit this.** |
| 2. Customer brand | `branding.config.ts` | build | The brand committed to a customer's repository. Empty by default. |
| 3. Deployment | `BRAND_*` environment variables | **runtime** | Per-deployment tweaks with no rebuild. |

Because layer 3 is read on each request, **one Docker image can serve several
customers** — change the environment variables, restart the container, and the
app is rebranded.

---

## Quick start: branding a new customer

### 1. Add the artwork

Drop the customer's files into `public/branding/`:

```
public/branding/
  acme-logo-light.svg   # wordmark for light backgrounds
  acme-logo-dark.svg    # wordmark for dark backgrounds
  acme-mark.svg         # square mark (icon source)
```

Assets must live under `/public`. The app's Content-Security-Policy sets
`img-src 'self' data: blob:`, so logos hosted on an external CDN are blocked.

> No artwork yet? Skip this step. The product ships with a neutral placeholder
> mark (`public/branding/mark.svg`) and, with `logo.light` unset, renders a text
> wordmark built from the application name — so it looks finished from day one.

### 2. Generate the icons

```bash
npm run brand:icons -- --source public/branding/acme-mark.svg --background "#ffffff"
```

This writes every favicon, apple-touch-icon and PWA icon into
`public/branding/`, at the sizes and filenames the neutral preset expects. For
the dark-background set, feed it a light-on-transparent version of the mark:

```bash
npm run brand:icons -- --source public/branding/acme-mark-white.svg \
  --suffix -dark --background "#0f172a"
```

The email logos are two PNGs in the same folder — `email-logo.png` for white
backgrounds and `email-logo-white.png` for the coloured header band. Generate
them from the same marks and copy the 256px output into place.

Other options: `--out` (output directory), `--prefix` (filename prefix),
`--background` (canvas color, default transparent), `--padding` (margin share,
0–0.4).

### 3. Edit `branding.config.ts`

```ts
const branding: BrandingOverrides = {
  app: {
    name: "Presenze Acme",
    shortName: "Acme",
    description: "Gestione presenze e orari dipendenti Acme",
    tagline: "Gestione Presenze e Orari",
  },
  company: {
    name: "Acme S.p.A.",
    website: "https://acme.example",
    supportEmail: "support@acme.example",
  },
  logo: {
    light: "/branding/acme-logo-light.svg",
    dark: "/branding/acme-logo-dark.svg",
    icon: "/branding/acme-mark.svg",
    alt: "Acme",
  },
  theme: {
    light: { primary: "18 90% 48%" },
    dark: { primary: "18 90% 58%" },
  },
};
```

Only list what differs — anything omitted keeps the neutral default.

### 4. Ship it

```bash
npm run build && npm run docker:up
```

---

## Theming

### The easy path: one color

Set a single hex value and the primary color, its readable foreground and the
focus ring are all derived for you:

```env
BRAND_PRIMARY_COLOR=#ff6600
BRAND_PRIMARY_COLOR_DARK=#ff8534   # optional; defaults to BRAND_PRIMARY_COLOR
```

The foreground is chosen from the color's relative luminance, so text on the
brand color stays readable without manual tuning. An invalid hex value is
ignored with a warning rather than producing a broken interface.

### The full path: every token

The design system uses the standard shadcn token set. Values are **raw HSL
triplets** (`"221.2 83.2% 53.3%"`), because they are consumed as
`hsl(var(--token))`.

In `branding.config.ts`:

```ts
theme: {
  radius: "0.5rem",
  light: { background: "0 0% 100%", primary: "18 90% 48%", border: "20 15% 90%" },
  dark:  { background: "20 14% 8%",  primary: "18 90% 58%" },
}
```

Or at runtime as JSON:

```env
BRAND_THEME_LIGHT={"primary":"18 90% 48%","ring":"18 90% 48%"}
BRAND_THEME_DARK={"primary":"18 90% 58%"}
BRAND_RADIUS=0.5rem
```

Available tokens: `background`, `foreground`, `card`, `cardForeground`,
`popover`, `popoverForeground`, `primary`, `primaryForeground`, `secondary`,
`secondaryForeground`, `muted`, `mutedForeground`, `accent`, `accentForeground`,
`destructive`, `destructiveForeground`, `border`, `input`, `ring`, `chart1`–
`chart5`.

### How it reaches the page

The root layout renders the resolved tokens into a `<style id="brand-theme">`
element. Its selectors (`html:root`, `html:root.dark`) outrank the `:root` /
`.dark` rules in `globals.css`, so the branded palette always wins while
`globals.css` remains a working fallback.

---

## Emails

The six transactional templates (welcome, password reset, leave request to
admin, leave decision to employee, missing-timesheet reminder, backup report)
all pull their name, logo and colors from the branding config.

Email clients don't support CSS variables, so the email palette is a separate
set of plain hex colors with semantic roles:

| Role | Used by |
|------|---------|
| `primary` | Welcome and password-reset headers and buttons |
| `success` | Approved requests, successful backups |
| `warning` | New requests awaiting action, modified requests, reminders |
| `danger` | Rejected requests, failed backups |
| `info` | Informational callout boxes |

```env
BRAND_EMAIL_COLOR_PRIMARY=#059669
BRAND_EMAIL_COLOR_WARNING=#d97706
```

Logos are attached by CID and referenced as `cid:logo` / `cid:logo-white`. Point
them at the customer's files — paths are relative to `/public`:

```env
BRAND_EMAIL_LOGO_LIGHT=branding/acme-email-logo.png
BRAND_EMAIL_LOGO_DARK=branding/acme-email-logo-white.png
BRAND_EMAIL_LOGO_WIDTH=180  # 180 suits a wordmark; ~96 suits a square mark
```

Use PNG rather than SVG — SVG support in email clients is poor. `logo-white`
sits on the colored header band, so it should be a light/white version of the
mark.

The sender name falls back to the branded app name when `EMAIL_FROM_NAME` is
unset, so there is usually no reason to set it.

---

## PWA identity

`/manifest.webmanifest` is generated per request from the branding config —
name, short name, description, colors and icons all follow. The old static
`public/manifest.json` is gone.

```env
BRAND_PWA_THEME_COLOR_LIGHT=#f8fafc
BRAND_PWA_THEME_COLOR_DARK=#0f172a
BRAND_PWA_BACKGROUND_COLOR=#f8fafc
```

Custom icon sets can be declared as JSON when you deviate from the default
filenames:

```env
BRAND_PWA_ICONS=[{"src":"/branding/acme-192.png","sizes":"192x192","type":"image/png"}]
BRAND_PWA_ICONS_DARK=[{"src":"/branding/acme-192-dark.png","sizes":"192x192","type":"image/png"}]
```

Each entry is emitted twice, as `any` and as `maskable`, so Android can crop it
into the platform icon shape.

---

## Regional settings

The public-holiday calendar is country-aware:

```ts
regional: {
  holidayCountry: "FR",
  holidayState: null,
  holidayRegion: null,
  timezone: "Europe/Paris",
}
```

Holidays are computed on **both the server and the browser**, so this one
setting must resolve identically in both — a runtime-only override would desync
them and break hydration. Set it in `branding.config.ts`, or use the build-time
variable:

```env
NEXT_PUBLIC_BRAND_HOLIDAY_COUNTRY=FR
```

Backed by [`date-holidays`](https://github.com/commenthol/date-holidays); see
its country list for supported codes.

---

## Full environment variable reference

All of these are optional and override `branding.config.ts` at runtime.

**Identity** — `BRAND_APP_NAME`, `BRAND_APP_SHORT_NAME`, `BRAND_APP_DESCRIPTION`,
`BRAND_APP_TAGLINE`, `BRAND_APP_SUBTITLE`, `BRAND_LOCALE`, `BRAND_HTML_LANG`

**Company** — `BRAND_COMPANY_NAME`, `BRAND_COMPANY_WEBSITE`, `BRAND_SUPPORT_EMAIL`

**Logo** — `BRAND_LOGO_LIGHT`, `BRAND_LOGO_DARK`, `BRAND_LOGO_ICON`,
`BRAND_LOGO_ALT`, `BRAND_LOGO_WIDTH`, `BRAND_LOGO_HEIGHT`,
`BRAND_EMAIL_LOGO_LIGHT`, `BRAND_EMAIL_LOGO_DARK`, `BRAND_EMAIL_LOGO_WIDTH`

**Icons** — `BRAND_FAVICON`, `BRAND_FAVICON_DARK`, `BRAND_APPLE_TOUCH_ICON`,
`BRAND_PWA_ICONS`, `BRAND_PWA_ICONS_DARK`

**Theme** — `BRAND_PRIMARY_COLOR`, `BRAND_PRIMARY_COLOR_DARK`, `BRAND_RADIUS`,
`BRAND_THEME_LIGHT`, `BRAND_THEME_DARK`

**PWA** — `BRAND_PWA_THEME_COLOR_LIGHT`, `BRAND_PWA_THEME_COLOR_DARK`,
`BRAND_PWA_BACKGROUND_COLOR`

**Email** — `BRAND_EMAIL_COLOR_PRIMARY`, `BRAND_EMAIL_COLOR_SUCCESS`,
`BRAND_EMAIL_COLOR_WARNING`, `BRAND_EMAIL_COLOR_DANGER`, `BRAND_EMAIL_COLOR_INFO`

**Build-time** — `NEXT_PUBLIC_BRAND_HOLIDAY_COUNTRY`

Optional string settings accept the literal value `none` to clear them — for
example `BRAND_COMPANY_WEBSITE=none` removes the link from the login footer.

---

## Multi-tenant deployments

To serve several customers from one image, keep `branding.config.ts` neutral and
give each deployment its own environment:

```yaml
# docker-compose.acme.yml
services:
  app:
    image: ghcr.io/you/time-tracker:latest
    environment:
      BRAND_APP_NAME: Presenze Acme
      BRAND_COMPANY_NAME: Acme S.p.A.
      BRAND_PRIMARY_COLOR: "#ff6600"
      BRAND_LOGO_LIGHT: /branding/acme-logo-light.svg
    volumes:
      # Mount the customer's artwork over the branding folder
      - ./customers/acme/branding:/app/public/branding:ro
```

`docker-compose.yml` already passes every `BRAND_*` variable through, so a `.env`
file next to it is enough for the single-customer case.

**One caveat:** the offline fallback page (`/~offline`) is prerendered at build
time so it stays available without a network, which means it carries the
branding present when the image was built. Every other page resolves branding at
request time.

---

## Extending the system

Adding a new brandable setting takes three steps:

1. Add the field to the relevant type in `types/branding.ts`.
2. Give it a default in `branding/presets/neutral.ts`.
3. Map an environment variable in `applyEnvOverrides()` in `lib/branding.ts`.

Then read it with `getBranding()` in server code, or add it to `PublicBranding`
and read it with `useBranding()` in client components.

---

## Checklist before handing a build to a customer

- [ ] `branding.config.ts` holds their name, company and logo paths
- [ ] Logo assets are in `public/branding/`, in light and dark variants
- [ ] `npm run brand:icons` has been run; favicons and PWA icons match
- [ ] Email logos are PNG and read correctly on the colored header band
- [ ] Primary color is set, and text on it is readable in both themes
- [ ] `holidayCountry` and `TZ` match the customer's country
- [ ] `NEXTAUTH_URL` and `APP_URL` point at their domain
- [ ] Installed the PWA once to confirm the name and icon on the home screen
- [ ] Triggered one email of each type and checked the branding
