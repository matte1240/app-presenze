// Bundles the API server into a single ESM file. Only the three runtime
// dependencies stay external, so the runtime image needs a fraction of
// node_modules.
import { build } from "esbuild";
import { cpSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const r = (p) => fileURLToPath(new URL(p, import.meta.url));

await build({
  entryPoints: [r("../src/server/index.ts")],
  outfile: r("../dist/server/index.js"),
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  sourcemap: false,
  minify: false,
  external: ["postgres", "exceljs", "nodemailer"],
  banner: {
    // esbuild's ESM output can still emit require() shims for CJS deps.
    js: "import{createRequire as __cr}from'node:module';const require=__cr(import.meta.url);",
  },
  alias: {
    "@core": r("../src/core"),
    "@server": r("../src/server"),
  },
});

// The migrations are data, not code, so esbuild does not carry them along;
// the server looks for them next to itself at startup.
mkdirSync(r("../dist/server/migrations"), { recursive: true });
cpSync(r("../src/server/db/migrations"), r("../dist/server/migrations"), { recursive: true });

console.log("server bundled -> dist/server/index.js (migrazioni incluse)");
