import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: r("./src/web"),
  publicDir: r("./public"),
  plugins: [
    tanstackRouter({
      routesDirectory: r("./src/web/routes"),
      generatedRouteTree: r("./src/web/routeTree.gen.ts"),
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Presenze",
        short_name: "Presenze",
        description: "Gestione presenze e cartellini",
        theme_color: "#4f46e5",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/branding/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/branding/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@core": r("./src/core"),
      "@server": r("./src/server"),
      "@web": r("./src/web"),
    },
  },
  build: {
    outDir: r("./dist/web"),
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        bypass: (request) => request.url?.endsWith(".ts") ? request.url : undefined,
      },
    },
  },
});
