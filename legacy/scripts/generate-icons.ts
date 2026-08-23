#!/usr/bin/env tsx
/**
 * Generate every favicon and PWA icon from a single source image.
 *
 * Usage:
 *   npm run brand:icons -- --source public/branding/acme-mark.svg
 *   npm run brand:icons -- --source logo.png --background "#0f172a" --suffix -dark
 *   npm run brand:icons -- --source logo.svg --out public/branding --prefix acme-
 *
 * Options:
 *   --source      Source image (SVG or raster). Required.
 *   --out         Output directory. Default: public/branding
 *   --prefix      Filename prefix for the generated files. Default: none
 *   --suffix      Filename suffix, e.g. "-dark" for the dark-background set.
 *                 Default: none
 *   --background  Canvas color behind the artwork, any CSS color or
 *                 "transparent". Default: transparent
 *   --padding     Share of the canvas left as margin, 0–0.4. Default: 0.1
 *
 * The generated filenames match the defaults in `branding/presets/neutral.ts`,
 * so a plain run drops straight into place. When using --prefix or --out, point
 * `icons.*` in `branding.config.ts` at the new paths.
 */
import path from "node:path";
import fs from "node:fs/promises";
import sharp from "sharp";

type Options = {
  source: string;
  out: string;
  prefix: string;
  suffix: string;
  background: string;
  padding: number;
};

/** size in px → output basename (before prefix/suffix are applied) */
const TARGETS: Array<{ size: number; name: string }> = [
  { size: 32, name: "favicon" },
  { size: 180, name: "apple-touch-icon" },
  { size: 192, name: "icon-192" },
  { size: 256, name: "icon-256" },
  { size: 384, name: "icon-384" },
  { size: 512, name: "icon-512" },
];

async function main() {
  const options = parseArgs(process.argv.slice(2));

  const sourcePath = path.resolve(process.cwd(), options.source);
  try {
    await fs.access(sourcePath);
  } catch {
    fail(`source image not found: ${options.source}`);
  }

  const outDir = path.resolve(process.cwd(), options.out);
  await fs.mkdir(outDir, { recursive: true });

  const background =
    options.background === "transparent"
      ? { r: 0, g: 0, b: 0, alpha: 0 }
      : options.background;

  console.log(`🎨 Generating icons from ${options.source}`);

  for (const target of TARGETS) {
    const inner = Math.round(target.size * (1 - options.padding * 2));
    const margin = Math.round((target.size - inner) / 2);

    // Render the source at high density first so SVG sources stay crisp.
    const artwork = await sharp(sourcePath, { density: 512 })
      .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    const fileName = `${options.prefix}${target.name}${options.suffix}.png`;
    const outPath = path.join(outDir, fileName);

    await sharp({
      create: {
        width: target.size,
        height: target.size,
        channels: 4,
        background,
      },
    })
      .composite([{ input: artwork, top: margin, left: margin }])
      .png()
      .toFile(outPath);

    console.log(`  ✓ ${path.relative(process.cwd(), outPath)} (${target.size}×${target.size})`);
  }

  console.log("\n✅ Done. Update `icons` in branding.config.ts if you changed --out or --prefix.");
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    source: "",
    out: "public/branding",
    prefix: "",
    suffix: "",
    background: "transparent",
    padding: 0.1,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;

    const key = arg.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      fail(`missing value for --${key}`);
    }
    i += 1;

    switch (key) {
      case "source":
        options.source = value;
        break;
      case "out":
        options.out = value;
        break;
      case "prefix":
        options.prefix = value;
        break;
      case "suffix":
        options.suffix = value;
        break;
      case "background":
        options.background = value;
        break;
      case "padding": {
        const padding = Number(value);
        if (!Number.isFinite(padding) || padding < 0 || padding > 0.4) {
          fail("--padding must be a number between 0 and 0.4");
        }
        options.padding = padding;
        break;
      }
      default:
        fail(`unknown option --${key}`);
    }
  }

  if (!options.source) {
    fail("--source is required, e.g. --source public/branding/acme-mark.svg");
  }

  return options;
}

function fail(message: string): never {
  console.error(`❌ ${message}`);
  console.error("   Run `npm run brand:icons -- --help` details are in scripts/generate-icons.ts");
  process.exit(1);
}

main().catch((error) => {
  console.error("❌ Icon generation failed:", error);
  process.exit(1);
});
