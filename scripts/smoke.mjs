#!/usr/bin/env node
// Smoke test: boots the BUILT server on a throwaway database and
// checks the three load-bearing behaviors — the SPA serves, state
// without a cookie is 401, and a sandbox can be created. Run after
// `npm run build`. Exits non-zero on the first failed check.

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const ENTRY = join(ROOT, "dist/server/api/main.js");

if (!existsSync(ENTRY)) {
  console.error("built server not found; run `npm run build` first");
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), "frankenguard-smoke-"));
const dbPath = join(dir, "smoke.db");
const port = 31_997;
const base = `http://127.0.0.1:${port}`;

const child = spawn(process.execPath, [ENTRY], {
  env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", DB_PATH: dbPath, NODE_ENV: "production" },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
child.stdout.on("data", (chunk) => {
  output += chunk;
});
child.stderr.on("data", (chunk) => {
  output += chunk;
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

function check(name, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) throw new Error(`smoke check failed: ${name}`);
}

let failed = null;
try {
  await waitForHealthz();
  const home = await fetch(`${base}/`);
  check("GET / serves the SPA", home.status === 200 && (await home.text()).includes("FrankenGuard"), `HTTP ${home.status}`);
  const state = await fetch(`${base}/api/state`);
  check("GET /api/state without a cookie is 401", state.status === 401, `HTTP ${state.status}`);
  const created = await fetch(`${base}/api/sandbox`, { method: "POST" });
  const createdBody = await created.json().catch(() => null);
  check(
    "POST /api/sandbox creates a sandbox",
    created.status === 201 && typeof createdBody?.sandboxId === "string",
    `HTTP ${created.status}`,
  );
  const cookie = created.headers.get("set-cookie") ?? "";
  check("sandbox response sets the cookie", cookie.includes("fg_sandbox="));
  const authed = await fetch(`${base}/api/state`, { headers: { cookie } });
  check("GET /api/state with a cookie is 200", authed.status === 200, `HTTP ${authed.status}`);
  console.log("smoke: all checks passed");
} catch (error) {
  failed = error;
  console.error(failed instanceof Error ? failed.message : failed);
  console.error("--- server output ---");
  console.error(output);
} finally {
  child.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 500));
  if (child.exitCode === null) child.kill("SIGKILL");
  rmSync(dir, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
