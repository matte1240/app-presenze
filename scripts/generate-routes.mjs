// Generates the TanStack Router route tree file (src/web/routeTree.gen.ts).
// This file is gitignored but required by tsc; run this before typechecking
// in environments where the Vite dev server hasn't done so already (e.g. CI).
import { Generator, configSchema } from "@tanstack/router-generator";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));

const config = configSchema.parse({
  routesDirectory: "./src/web/routes",
  generatedRouteTree: "./src/web/routeTree.gen.ts",
  target: "react",
  autoCodeSplitting: true,
  tmpDir: join(tmpdir(), "tanstack-router-gen"),
});

const generator = new Generator({ config, root });
await generator.run();
console.log("route tree generated -> src/web/routeTree.gen.ts");
