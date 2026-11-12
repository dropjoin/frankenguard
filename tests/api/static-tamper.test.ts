import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { openDb } from "../../src/db/migrate.js";
import { buildApp } from "../../src/api/server.js";
import { FakeClock } from "../../src/shared/clock.js";
import { newSandbox, withCookie } from "./helpers.js";

// Static serving and the SPA fallback (8.1), plus the flag-gated
// tamper demo (8.6). The fallback must never shadow the API: /api
// paths and non-read methods always get the JSON envelope.

describe("static serving and SPA fallback", () => {
  let webRoot = "";

  beforeEach(() => {
    webRoot = mkdtempSync(join(tmpdir(), "frankenguard-web-"));
    writeFileSync(join(webRoot, "index.html"), "<!doctype html><title>FrankenGuard</title><div id=root></div>");
    writeFileSync(join(webRoot, "app.js"), "console.log('spa');");
  });

  afterEach(() => {
    rmSync(webRoot, { recursive: true, force: true });
  });

  async function makeStaticApp() {
    const db = openDb(":memory:");
    const clock = new FakeClock("2026-11-13T12:00:00.000Z");
    const app = buildApp({ db, clock, agentMode: "scripted", webRoot });
    await app.ready();
    return app;
  }

  it("serves / and built assets from the web root", async () => {
    const app = await makeStaticApp();
    const home = await app.inject({ method: "GET", url: "/" });
    expect(home.statusCode).toBe(200);
    expect(home.body).toContain("FrankenGuard");
    const asset = await app.inject({ method: "GET", url: "/app.js" });
    expect(asset.statusCode).toBe(200);
    expect(asset.body).toContain("spa");
    await app.close();
  });

  it("falls back to index.html for unknown non-API paths", async () => {
    const app = await makeStaticApp();
    const res = await app.inject({ method: "GET", url: "/some/deep/link" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("FrankenGuard");
    await app.close();
  });

  it("never shadows the API: unknown /api paths get the JSON envelope", async () => {
    const app = await makeStaticApp();
    const res = await app.inject({ method: "GET", url: "/api/nope" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: { code: "NOT_FOUND", message: "route was not found" } });
    await app.close();
  });

  it("never serves a page for non-read methods", async () => {
    const app = await makeStaticApp();
    const res = await app.inject({ method: "POST", url: "/some/deep/link", payload: {} });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: { code: "NOT_FOUND", message: "route was not found" } });
    await app.close();
  });

  it("serves the API normally alongside the SPA", async () => {
    const app = await makeStaticApp();
    const state = await app.inject({ method: "GET", url: "/api/state" });
    expect(state.statusCode).toBe(401);
    const created = await app.inject({ method: "POST", url: "/api/sandbox" });
    expect(created.statusCode).toBe(201);
    await app.close();
  });
});

describe("tamper demo", () => {
  async function makeTamperApp(tamperDemo: boolean) {
    const db = openDb(":memory:");
    const clock = new FakeClock("2026-11-13T12:00:00.000Z");
    const app = buildApp({ db, clock, agentMode: "scripted", tamperDemo });
    await app.ready();
    return { db, app };
  }

  it("does not exist with the flag off", async () => {
    const { app } = await makeTamperApp(false);
    const { cookie } = await newSandbox(app);
    const res = await app.inject(withCookie(cookie, { method: "POST", url: "/api/_demo/tamper", payload: { seq: 1 } }));
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: { code: "NOT_FOUND", message: "route was not found" } });
    await app.close();
  });

  it("breaks verification at the tampered seq with the flag on", async () => {
    const { app } = await makeTamperApp(true);
    const { cookie } = await newSandbox(app);
    await app.inject(
      withCookie(cookie, {
        method: "POST",
        url: "/api/proposals",
        payload: { recipient: "acme-corp", amountCents: 10_000, currency: "USD", memo: "" },
      }),
    );
    const before = await app.inject(withCookie(cookie, { method: "GET", url: "/api/audit/verify" }));
    expect(before.json()).toMatchObject({ ok: true });
    const tampered = await app.inject(
      withCookie(cookie, { method: "POST", url: "/api/_demo/tamper", payload: { seq: 2 } }),
    );
    expect(tampered.statusCode).toBe(200);
    expect(tampered.json()).toEqual({ seq: 2, tampered: true });
    const after = await app.inject(withCookie(cookie, { method: "GET", url: "/api/audit/verify" }));
    expect(after.json()).toMatchObject({ ok: false, brokenAtSeq: 2 });
    await app.close();
  });

  it("rejects a non-integer seq and an unknown seq", async () => {
    const { app } = await makeTamperApp(true);
    const { cookie } = await newSandbox(app);
    const bad = await app.inject(
      withCookie(cookie, { method: "POST", url: "/api/_demo/tamper", payload: { seq: "two" } }),
    );
    expect(bad.statusCode).toBe(422);
    const missing = await app.inject(
      withCookie(cookie, { method: "POST", url: "/api/_demo/tamper", payload: { seq: 99 } }),
    );
    expect(missing.statusCode).toBe(404);
    await app.close();
  });

  it("cannot touch another sandbox's entries", async () => {
    const { app } = await makeTamperApp(true);
    const first = await newSandbox(app);
    await app.inject(
      withCookie(first.cookie, {
        method: "POST",
        url: "/api/proposals",
        payload: { recipient: "acme-corp", amountCents: 10_000, currency: "USD", memo: "" },
      }),
    );
    const second = await newSandbox(app);
    const res = await app.inject(
      withCookie(second.cookie, { method: "POST", url: "/api/_demo/tamper", payload: { seq: 2 } }),
    );
    expect(res.statusCode).toBe(404);
    const firstVerify = await app.inject(withCookie(first.cookie, { method: "GET", url: "/api/audit/verify" }));
    expect(firstVerify.json()).toMatchObject({ ok: true });
    await app.close();
  });
});
