import { describe, expect, it } from "vitest";

import { openDb } from "../../src/db/migrate.js";
import { buildApp } from "../../src/api/server.js";
import { createLimiters, TokenBucket } from "../../src/api/rateLimit.js";
import { FakeClock } from "../../src/shared/clock.js";
import { makeApp, newSandbox, withCookie } from "./helpers.js";

describe("TokenBucket", () => {
  it("allows up to capacity, then refuses with a retry-after", () => {
    const bucket = new TokenBucket(3, 3 / 60_000);
    const now = 1_000_000;
    expect(bucket.take("k", now).allowed).toBe(true);
    expect(bucket.take("k", now).allowed).toBe(true);
    expect(bucket.take("k", now).allowed).toBe(true);
    const denied = bucket.take("k", now);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSeconds).toBeGreaterThan(0);
    // A different key has its own budget.
    expect(bucket.take("other", now).allowed).toBe(true);
  });

  it("refills linearly and never exceeds capacity", () => {
    const bucket = new TokenBucket(2, 2 / 60_000);
    const now = 1_000_000;
    bucket.take("k", now);
    bucket.take("k", now);
    expect(bucket.take("k", now).allowed).toBe(false);
    // 30s refills 1 token.
    expect(bucket.take("k", now + 30_000).allowed).toBe(true);
    expect(bucket.take("k", now + 30_000).allowed).toBe(false);
    // An hour later the bucket is full again, not overfull.
    expect(bucket.take("k", now + 3_600_000).allowed).toBe(true);
    expect(bucket.take("k", now + 3_600_000).allowed).toBe(true);
    expect(bucket.take("k", now + 3_600_000).allowed).toBe(false);
  });

  it("treats backward clock movement as no elapsed time", () => {
    const bucket = new TokenBucket(1, 1 / 60_000);
    bucket.take("k", 1_000_000);
    expect(bucket.take("k", 500_000).allowed).toBe(false);
  });
});

describe("API rate limits", () => {
  it("throttles writes at 30/min per sandbox with Retry-After, then refills", async () => {
    const { app, clock } = await makeApp();
    const { cookie } = await newSandbox(app);
    const body = { recipient: "acme-corp", amountCents: 100, currency: "USD", memo: "" };
    for (let i = 0; i < 30; i++) {
      const res = await app.inject(withCookie(cookie, { method: "POST", url: "/api/proposals", payload: body }));
      expect(res.statusCode).toBe(200);
    }
    const limited = await app.inject(withCookie(cookie, { method: "POST", url: "/api/proposals", payload: body }));
    expect(limited.statusCode).toBe(429);
    expect((limited.json() as { error: { code: string } }).error.code).toBe("RATE_LIMITED");
    expect(limited.headers["retry-after"]).toBeDefined();
    clock.advanceMinutes(1);
    const refilled = await app.inject(withCookie(cookie, { method: "POST", url: "/api/proposals", payload: body }));
    expect(refilled.statusCode).toBe(200);
  });

  it("throttles reads at 120/min per sandbox", async () => {
    const db = openDb(":memory:");
    const clock = new FakeClock("2026-11-13T12:00:00.000Z");
    const limiters = createLimiters();
    // Raise the IP bucket so only the per-sandbox read bucket can fire.
    limiters.perIp = new TokenBucket(10_000, 10_000 / 60_000);
    const app = buildApp({ db, clock, agentMode: "scripted", limiters });
    await app.ready();
    const { cookie } = await newSandbox(app);
    for (let i = 0; i < 120; i++) {
      const res = await app.inject(withCookie(cookie, { method: "GET", url: "/api/state" }));
      expect(res.statusCode).toBe(200);
    }
    const limited = await app.inject(withCookie(cookie, { method: "GET", url: "/api/state" }));
    expect(limited.statusCode).toBe(429);
  });

  it("throttles sandbox creation at 10/hour per IP", async () => {
    const { app } = await makeApp();
    for (let i = 0; i < 10; i++) {
      const res = await app.inject({ method: "POST", url: "/api/sandbox" });
      expect(res.statusCode).toBe(201);
    }
    const limited = await app.inject({ method: "POST", url: "/api/sandbox" });
    expect(limited.statusCode).toBe(429);
  });

  it("throttles the per-IP bucket at 120/min across sandboxes", async () => {
    const { app } = await makeApp();
    const first = await newSandbox(app);
    const second = await newSandbox(app);
    // 2 creations + 59 reads on each sandbox = 120 IP requests, with
    // neither sandbox near its own 120/min read budget.
    for (let i = 0; i < 59; i++) {
      expect((await app.inject(withCookie(first.cookie, { method: "GET", url: "/api/state" }))).statusCode).toBe(200);
      expect((await app.inject(withCookie(second.cookie, { method: "GET", url: "/api/state" }))).statusCode).toBe(200);
    }
    const limited = await app.inject(withCookie(first.cookie, { method: "GET", url: "/api/state" }));
    expect(limited.statusCode).toBe(429);
    expect((limited.json() as { error: { code: string } }).error.code).toBe("RATE_LIMITED");
  });

  it("gates prompt runs on the live bucket only in live mode; scenarios use the write bucket", async () => {
    const db = openDb(":memory:");
    const clock = new FakeClock("2026-11-13T12:00:00.000Z");
    const app = buildApp({
      db,
      clock,
      agentMode: "live",
      liveAgent: { run: async () => [{ recipient: "acme-corp", amountCents: 100, currency: "USD", memo: "live" }] },
    });
    await app.ready();
    const { cookie } = await newSandbox(app);
    for (let i = 0; i < 6; i++) {
      const res = await app.inject(
        withCookie(cookie, { method: "POST", url: "/api/agent/run", payload: { prompt: "pay acme" } }),
      );
      expect(res.statusCode).toBe(200);
    }
    const limited = await app.inject(
      withCookie(cookie, { method: "POST", url: "/api/agent/run", payload: { prompt: "pay acme" } }),
    );
    expect(limited.statusCode).toBe(429);
    // Scenarios are unaffected by the live bucket.
    const scenario = await app.inject(
      withCookie(cookie, { method: "POST", url: "/api/agent/run", payload: { scenario: "happy_path" } }),
    );
    expect(scenario.statusCode).toBe(200);
  });
});
