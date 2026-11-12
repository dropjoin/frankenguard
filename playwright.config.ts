import { defineConfig } from "@playwright/test";

// End-to-end suite against the real built server. The webServer
// builds once, wipes the throwaway database, and starts with the
// tamper demo enabled (the suite proves the broken-chain state
// through it). Tests share one browser context per file on purpose:
// sandbox creation is rate-limited to 10/hour/IP, and a fresh
// context per test would burn the budget before the suite finishes.

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { viewport: { width: 1280, height: 800 } },
    },
    {
      name: "mobile",
      use: { viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true },
    },
  ],
  webServer: {
    command:
      "npm run build && rm -f /tmp/frankenguard-e2e.db* && PORT=4173 HOST=127.0.0.1 DB_PATH=/tmp/frankenguard-e2e.db TAMPER_DEMO=1 node dist/server/api/main.js",
    url: "http://127.0.0.1:4173/healthz",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
