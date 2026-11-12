#!/usr/bin/env node
// Visual QA captures (task 8.3): six states at three viewports,
// driven against the real built server with the tamper demo on.
// One browser context per state (viewport resized in place) so the
// run stays inside the sandbox-creation budget. Captures use
// ?shot=1, which freezes motion for stable screenshots.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { chromium } from "playwright";

const ROOT = new URL("..", import.meta.url).pathname;
const ENTRY = join(ROOT, "dist/server/api/main.js");
const OUT = join(ROOT, "screenshots");

if (!existsSync(ENTRY)) {
  console.error("built server not found; run `npm run build` first");
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

const dir = mkdtempSync(join(tmpdir(), "frankenguard-shots-"));
const port = 31_998;
const base = `http://127.0.0.1:${port}`;

const child = spawn(process.execPath, [ENTRY], {
  env: {
    ...process.env,
    PORT: String(port),
    HOST: "127.0.0.1",
    DB_PATH: join(dir, "shots.db"),
    TAMPER_DEMO: "1",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

async function waitForHealthz(deadlineMs = 15_000) {
  const started = Date.now();
  for (;;) {
    try {
      const res = await fetch(`${base}/healthz`);
      if (res.ok) return;
    } catch {
      // Not up yet.
    }
    if (Date.now() - started > deadlineMs) throw new Error("server did not become healthy in time");
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

async function freshPage(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto(`${base}/?shot=1`);
  await page.getByRole("heading", { name: "Agent" }).waitFor();
  return { context, page };
}

async function runScenario(page, label, count) {
  await page.getByRole("button", { name: label }).click();
  await page.locator(".decision-card").nth(count - 1).waitFor();
  await page.waitForTimeout(300);
}

const STATES = {
  default: async () => {},
  approved: async ({ page }) => {
    await runScenario(page, /Happy path/, 1);
  },
  blocked: async ({ page }) => {
    await runScenario(page, /Prompt injection/, 1);
  },
  frozen: async ({ page }) => {
    await page.getByRole("switch", { name: "Freeze all payments" }).click();
    await page.locator(".frozen-banner-wrap").waitFor();
    await runScenario(page, /Frozen system/, 1);
  },
  verified: async ({ page }) => {
    await runScenario(page, /Happy path/, 1);
    await page.getByRole("button", { name: "Verify chain" }).click();
    await page.getByText("Chain intact").waitFor();
    await page.waitForTimeout(300);
  },
  broken: async ({ page }) => {
    await runScenario(page, /Happy path/, 1);
    const audit = await page.request.get(`${base}/api/audit?limit=50`);
    const entries = (await audit.json()).entries;
    const targetSeq = entries[1].seq;
    await page.request.post(`${base}/api/_demo/tamper`, { data: { seq: targetSeq } });
    await page.getByRole("button", { name: "Verify chain" }).click();
    await page.getByText("Chain broken").waitFor();
    await page.waitForTimeout(300);
  },
};

let failed = null;
let browser;
try {
  await waitForHealthz();
  browser = await chromium.launch();
  for (const [state, setup] of Object.entries(STATES)) {
    const { context, page } = await freshPage(browser);
    try {
      await setup({ page });
      for (const width of [1280, 768, 375]) {
        await page.setViewportSize({ width, height: 800 });
        await page.waitForTimeout(300);
        const file = join(OUT, `${state}-${width}.png`);
        await page.screenshot({ path: file, fullPage: true });
        console.log(`captured ${state} at ${width}px`);
      }
    } finally {
      await context.close();
    }
  }
  console.log("screenshots: done");
} catch (error) {
  failed = error;
  console.error(failed instanceof Error ? failed.message : failed);
} finally {
  if (browser) await browser.close();
  child.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 500));
  if (child.exitCode === null) child.kill("SIGKILL");
  rmSync(dir, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
