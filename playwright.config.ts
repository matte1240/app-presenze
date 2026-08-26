import { defineConfig } from "@playwright/test";

/**
 * The smoke suite drives a real browser against the built application, because
 * the one thing no API test can check is whether a page is reachable at all.
 * That gap is not hypothetical: the whole back-office once shipped unreachable
 * — a layout route with no `<Outlet/>` — with every API test green.
 *
 * It needs a database. `E2E_DATABASE_URL` and `E2E_DATABASE_ADMIN_URL` say
 * which; without them the suite is skipped rather than failed, so `npm test`
 * still works on a machine with no PostgreSQL.
 */
const port = Number(process.env.E2E_PORT ?? 3210);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "line" : "list",
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: `http://127.0.0.1:${port}`,
    /**
     * Normally Playwright uses the Chromium it downloaded for its own version.
     * `PLAYWRIGHT_CHROMIUM_PATH` is the escape hatch for a machine that already
     * has one — a sandbox, a locked-down build agent — where re-downloading is
     * pointless or forbidden. Unset in CI, which installs its own.
     */
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
    // A failure here means a page did not render; a picture of what did is the
    // fastest way to see why.
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },

  webServer: {
    command: "node dist/server/index.js",
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      NODE_ENV: "production",
      PORT: String(port),
      APP_URL: `http://127.0.0.1:${port}`,
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? "",
      DATABASE_ADMIN_URL: process.env.E2E_DATABASE_ADMIN_URL ?? "",
      PLATFORM_ADMIN_EMAIL: "e2e@example.com",
      PLATFORM_ADMIN_PASSWORD: "E2ePassword1!",
      SIGNUP_ENABLED: "true",
      ENABLE_CRON: "false",
    },
  },
});
