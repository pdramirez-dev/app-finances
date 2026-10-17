import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3210);

// End-to-end flows run against `next dev` in demo mode (DEV_AUTH_BYPASS):
// UI, server actions and validation are real, AppSync is the in-memory demo
// store, so persistence itself is covered by the Postgres integration tests.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  // Demo data lives in one server process, so specs run one at a time.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Locally reuse the installed Chrome; CI installs Playwright's Chromium.
    channel: process.env.CI ? undefined : "chrome",
    // First webpack compile of a route can take a while in dev mode.
    navigationTimeout: 90_000,
    trace: "retain-on-failure",
    locale: "es-ES",
    timezoneId: "America/New_York",
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"], channel: process.env.CI ? undefined : "chrome" } }],
  webServer: {
    // Turbopack panics in this checkout ("Next.js package not found").
    command: `npx next dev --webpack -p ${PORT}`,
    url: `http://localhost:${PORT}/dashboard`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      DEV_AUTH_BYPASS: "true",
      AUTH_SECRET: "e2e-only-secret-not-used-for-real-sessions-0000",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
