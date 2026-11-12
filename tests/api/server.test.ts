import { describe, expect, it } from "vitest";

import { withImmediateTransaction, withPurgeMode } from "../../src/db/migrate.js";
import { cookieFromResponse, makeApp, newSandbox, withCookie } from "./helpers.js";

describe("health and sandbox session", () => {
  it("GET /healthz answers without a cookie", async () => {
    const { app } = await makeApp();
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });

  it("POST /api/sandbox creates a sandbox with a 201 and an HttpOnly Lax cookie", async () => {
    const { app } = await makeApp();
    const res = await app.inject({ method: "POST", url: "/api/sandbox" });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { sandboxId: string };
    expect(typeof body.sandboxId).toBe("string");
    const setCookie = String(res.headers["set-cookie"]);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).not.toContain("Secure");
  });

  it("sets the Secure flag when cookieSecure is on", async () => {
    const { app } = await makeApp({ cookieSecure: true });
    const res = await app.inject({ method: "POST", url: "/api/sandbox" });
    expect(String(res.headers["set-cookie"])).toContain("Secure");
  });

  it("POST /api/sandbox is idempotent for a live cookie: 200, same sandbox, no new cookie consumed", async () => {
    const { app } = await makeApp();
    const first = await newSandbox(app);
    const res = await app.inject(withCookie(first.cookie, { method: "POST", url: "/api/sandbox" }));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ sandboxId: first.sandboxId });
  });

  it("a request without a cookie gets 401 SANDBOX_EXPIRED with the error envelope", async () => {
    const { app } = await makeApp();
    const res = await app.inject({ method: "GET", url: "/api/state" });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({
      error: { code: "SANDBOX_EXPIRED", message: expect.any(String) },
    });
  });

  it("an idle-expired sandbox gets 401 and is never resurrected", async () => {
    const { app, clock } = await makeApp();
    const { cookie } = await newSandbox(app);
    clock.advanceMinutes(61);
    const res = await app.inject(withCookie(cookie, { method: "GET", url: "/api/state" }));
    expect(res.statusCode).toBe(401);
    const recreated = await app.inject(withCookie(cookie, { method: "POST", url: "/api/sandbox" }));
    expect(recreated.statusCode).toBe(201);
    expect((recreated.json() as { sandboxId: string }).sandboxId).not.toBe(cookie);
  });

  it("reset replaces the sandbox with a fresh one and the old data is gone", async () => {
    const { app } = await makeApp();
    const first = await newSandbox(app);
    await app.inject(
      withCookie(first.cookie, {
        method: "POST",
        url: "/api/proposals",
        payload: { recipient: "acme-corp", amountCents: 10_000, currency: "USD", memo: "" },
      }),
    );
    const reset = await app.inject(withCookie(first.cookie, { method: "POST", url: "/api/sandbox/reset" }));
    expect(reset.statusCode).toBe(200);
    const body = reset.json() as { sandboxId: string };
    expect(body.sandboxId).not.toBe(first.sandboxId);
    const newCookie = cookieFromResponse(reset);
    expect(newCookie).toBe(body.sandboxId);
    const state = await app.inject(withCookie(newCookie!, { method: "GET", url: "/api/state" }));
    // The state is fresh: no proposals carried over from the old sandbox.
    expect((state.json() as { proposalCount: number }).proposalCount).toBe(0);
  });

  it("sets the security headers on API responses", async () => {
    const { app } = await makeApp();
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.headers["content-security-policy"]).toBe("default-src 'self'");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
  });
});

describe("proposals API", () => {
  it("submits a valid proposal and returns the decision with 200", async () => {
    const { app } = await makeApp();
    const { cookie } = await newSandbox(app);
    const res = await app.inject(
      withCookie(cookie, {
        method: "POST",
        url: "/api/proposals",
        payload: { recipient: "acme-corp", amountCents: 10_000, currency: "USD", memo: "invoice" },
      }),
    );
    expect(res.statusCode).toBe(200);
    const body = res.json() as { outcome: string; status: string; reasons: unknown[] };
    expect(body.outcome).toBe("APPROVED");
    expect(body.status).toBe("EXECUTED");
    expect(body.reasons).toHaveLength(4);
  });

  it("records an object-shaped invalid proposal with 200 and INVALID_PROPOSAL", async () => {
    const { app } = await makeApp();
    const { cookie } = await newSandbox(app);
    const res = await app.inject(
      withCookie(cookie, {
        method: "POST",
        url: "/api/proposals",
        payload: { recipient: "acme-corp", amountCents: -1, currency: "USD", memo: "" },
      }),
    );
    expect(res.statusCode).toBe(200);
    expect((res.json() as { reason: string }).reason).toBe("INVALID_PROPOSAL");
  });

  it("refuses a non-object body with 422", async () => {
    const { app } = await makeApp();
    const { cookie } = await newSandbox(app);
    for (const payload of [`"just a string"`, `[1, 2]`, `42`]) {
      const res = await app.inject(
        withCookie(cookie, { method: "POST", url: "/api/proposals", payload, headers: { "content-type": "application/json" } }),
      );
      expect(res.statusCode).toBe(422);
      expect((res.json() as { error: { code: string } }).error.code).toBe("INVALID_INPUT");
    }
  });

  it("refuses malformed JSON with 422 and an oversized body with 413", async () => {
    const { app } = await makeApp();
    const { cookie } = await newSandbox(app);
    const malformed = await app.inject(
      withCookie(cookie, { method: "POST", url: "/api/proposals", payload: "{bad json", headers: { "content-type": "application/json" } }),
    );
    expect(malformed.statusCode).toBe(422);
    const big = await app.inject(
      withCookie(cookie, {
        method: "POST",
        url: "/api/proposals",
        payload: JSON.stringify({ recipient: "acme-corp", amountCents: 100, currency: "USD", memo: "x".repeat(9000) }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(big.statusCode).toBe(413);
    expect((big.json() as { error: { code: string } }).error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("refuses an absurdly nested body with 422, never a 500, and stays alive after it", async () => {
    const { app } = await makeApp();
    const { cookie } = await newSandbox(app);
    let deep: unknown = [];
    for (let i = 0; i < 3000; i++) deep = [deep];
    const res = await app.inject(
      withCookie(cookie, {
        method: "POST",
        url: "/api/proposals",
        payload: JSON.stringify({ recipient: deep, amountCents: 100, currency: "USD", memo: "" }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.statusCode).toBe(422);
    expect((res.json() as { error: { code: string } }).error.code).toBe("INVALID_INPUT");
    const health = await app.inject({ method: "GET", url: "/healthz" });
    expect(health.statusCode).toBe(200);
  });

  it("replays an idempotent submit and refuses a reused key with 409", async () => {
    const { app } = await makeApp();
    const { cookie } = await newSandbox(app);
    const body = { recipient: "acme-corp", amountCents: 10_000, currency: "USD", memo: "", idempotencyKey: "k1" };
    const first = await app.inject(withCookie(cookie, { method: "POST", url: "/api/proposals", payload: body }));
    const second = await app.inject(withCookie(cookie, { method: "POST", url: "/api/proposals", payload: body }));
    expect((second.json() as { replayed: boolean }).replayed).toBe(true);
    expect((second.json() as { proposalId: string }).proposalId).toBe(
      (first.json() as { proposalId: string }).proposalId,
    );
    const conflict = await app.inject(
      withCookie(cookie, { method: "POST", url: "/api/proposals", payload: { ...body, amountCents: 20_000 } }),
    );
    expect(conflict.statusCode).toBe(409);
    expect((conflict.json() as { error: { code: string } }).error.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  it("returns the proposal bundle, and 404 for an unknown id", async () => {
    const { app } = await makeApp();
    const { cookie } = await newSandbox(app);
    const submitted = await app.inject(
      withCookie(cookie, {
        method: "POST",
        url: "/api/proposals",
        payload: { recipient: "acme-corp", amountCents: 10_000, currency: "USD", memo: "" },
      }),
    );
    const id = (submitted.json() as { proposalId: string }).proposalId;
    const bundle = await app.inject(withCookie(cookie, { method: "GET", url: `/api/proposals/${id}` }));
    expect(bundle.statusCode).toBe(200);
    const body = bundle.json() as { decision: { outcome: string }; payment: { amountCents: number }; auditEntries: unknown[] };
    expect(body.decision.outcome).toBe("APPROVED");
    expect(body.payment.amountCents).toBe(10_000);
    expect(body.auditEntries).toHaveLength(3);
    const missing = await app.inject(withCookie(cookie, { method: "GET", url: "/api/proposals/nope" }));
    expect(missing.statusCode).toBe(404);
  });
});

describe("config API", () => {
  it("updates caps and the new caps govern the next decision", async () => {
    const { app } = await makeApp();
    const { cookie } = await newSandbox(app);
    const updated = await app.inject(
      withCookie(cookie, { method: "PUT", url: "/api/config/caps", payload: { perTxCapCents: 5_000, dailyCapCents: 10_000 } }),
    );
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toEqual({ configVersion: 2, perTxCapCents: 5_000, dailyCapCents: 10_000 });
    const res = await app.inject(
      withCookie(cookie, {
        method: "POST",
        url: "/api/proposals",
        payload: { recipient: "acme-corp", amountCents: 10_000, currency: "USD", memo: "" },
      }),
    );
    expect((res.json() as { reason: string }).reason).toBe("PER_TX_CAP_EXCEEDED");
  });

  it("rejects invalid caps with 422 and leaves the config untouched", async () => {
    const { app } = await makeApp();
    const { cookie } = await newSandbox(app);
    const res = await app.inject(
      withCookie(cookie, { method: "PUT", url: "/api/config/caps", payload: { perTxCapCents: 99, dailyCapCents: 50 } }),
    );
    expect(res.statusCode).toBe(422);
    const state = await app.inject(withCookie(cookie, { method: "GET", url: "/api/state" }));
    expect((state.json() as { configVersion: number }).configVersion).toBe(1);
  });

  it("adds and removes allowlist entries, with 409 on duplicates and 404 on missing", async () => {
    const { app } = await makeApp();
    const { cookie } = await newSandbox(app);
    const added = await app.inject(
      withCookie(cookie, { method: "POST", url: "/api/config/allowlist", payload: { recipient: "Umbrella Corp" } }),
    );
    expect(added.statusCode).toBe(200);
    expect(added.json()).toEqual({ recipientKey: "umbrella corp", label: "Umbrella Corp" });
    const dup = await app.inject(
      withCookie(cookie, { method: "POST", url: "/api/config/allowlist", payload: { recipient: "umbrella corp" } }),
    );
    expect(dup.statusCode).toBe(409);
    const removed = await app.inject(
      withCookie(cookie, { method: "DELETE", url: "/api/config/allowlist", payload: { recipient: "Umbrella Corp" } }),
    );
    expect(removed.statusCode).toBe(200);
    const gone = await app.inject(
      withCookie(cookie, { method: "DELETE", url: "/api/config/allowlist", payload: { recipient: "Umbrella Corp" } }),
    );
    expect(gone.statusCode).toBe(404);
  });

  it("freezes and unfreezes, and the freeze governs decisions immediately", async () => {
    const { app } = await makeApp();
    const { cookie } = await newSandbox(app);
    const frozen = await app.inject(
      withCookie(cookie, { method: "PUT", url: "/api/config/freeze", payload: { frozen: true, note: "hold" } }),
    );
    expect(frozen.json()).toEqual({ configVersion: 2, frozen: true });
    const res = await app.inject(
      withCookie(cookie, {
        method: "POST",
        url: "/api/proposals",
        payload: { recipient: "acme-corp", amountCents: 100, currency: "USD", memo: "" },
      }),
    );
    expect((res.json() as { reason: string }).reason).toBe("SYSTEM_FROZEN");
  });
});

describe("audit API", () => {
  it("lists entries with pagination and filters, and verifies an intact chain", async () => {
    const { app } = await makeApp();
    const { cookie } = await newSandbox(app);
    await app.inject(
      withCookie(cookie, {
        method: "POST",
        url: "/api/proposals",
        payload: { recipient: "acme-corp", amountCents: 10_000, currency: "USD", memo: "" },
      }),
    );
    const page = await app.inject(withCookie(cookie, { method: "GET", url: "/api/audit?limit=2" }));
    const pageBody = page.json() as { entries: { seq: number }[]; nextAfterSeq: number | null };
    expect(pageBody.entries).toHaveLength(2);
    expect(pageBody.nextAfterSeq).not.toBeNull();
    const filtered = await app.inject(withCookie(cookie, { method: "GET", url: "/api/audit?outcome=APPROVED" }));
    expect((filtered.json() as { entries: unknown[] }).entries).toHaveLength(1);
    const verify = await app.inject(withCookie(cookie, { method: "GET", url: "/api/audit/verify" }));
    expect(verify.json()).toMatchObject({ ok: true, entries: 4 });
  });

  it("rejects an invalid audit query with 422", async () => {
    const { app } = await makeApp();
    const { cookie } = await newSandbox(app);
    const res = await app.inject(withCookie(cookie, { method: "GET", url: "/api/audit?limit=0" }));
    expect(res.statusCode).toBe(422);
  });

  it("verify reports the broken sequence when an entry's hash is forged", async () => {
    const { app, db } = await makeApp();
    const { cookie, sandboxId } = await newSandbox(app);
    await app.inject(
      withCookie(cookie, {
        method: "POST",
        url: "/api/proposals",
        payload: { recipient: "acme-corp", amountCents: 10_000, currency: "USD", memo: "" },
      }),
    );
    const head = db.prepare("SELECT seq, hash FROM audit_log WHERE sandbox_id = ? ORDER BY seq DESC LIMIT 1").get(sandboxId) as {
      seq: number;
      hash: string;
    };
    db.prepare(
      "INSERT INTO audit_log (seq, sandbox_id, type, ts, actor, proposal_id, payload, prev_hash, hash) VALUES (?, ?, 'AUDIT_VERIFIED', ?, 'system', NULL, ?, ?, ?)",
    ).run(head.seq + 1, sandboxId, "2026-11-13T12:00:00.000Z", "{}", head.hash, "0".repeat(64));
    const verify = await app.inject(withCookie(cookie, { method: "GET", url: "/api/audit/verify" }));
    const body = verify.json() as { ok: boolean; brokenAtSeq: number };
    expect(body.ok).toBe(false);
    expect(body.brokenAtSeq).toBe(head.seq + 1);
  });

  it("verify reports broken with a 200, never a 500, when a stored payload is not canonical data", async () => {
    const { app, db } = await makeApp();
    const { cookie, sandboxId } = await newSandbox(app);
    withImmediateTransaction(db, () => {
      withPurgeMode(db, () => {
        db.prepare("UPDATE audit_log SET payload = ? WHERE sandbox_id = ?").run('{"amountCents": 1.5}', sandboxId);
      });
    });
    const verify = await app.inject(withCookie(cookie, { method: "GET", url: "/api/audit/verify" }));
    expect(verify.statusCode).toBe(200);
    expect(verify.json()).toMatchObject({ ok: false, reason: "payload is not canonical JSON data" });
  });

  it("lists the audit view with a 200, marking the entry, when one payload cannot be parsed", async () => {
    const { app, db } = await makeApp();
    const { cookie, sandboxId } = await newSandbox(app);
    await app.inject(
      withCookie(cookie, {
        method: "POST",
        url: "/api/proposals",
        payload: { recipient: "acme-corp", amountCents: 10_000, currency: "USD", memo: "" },
      }),
    );
    withImmediateTransaction(db, () => {
      withPurgeMode(db, () => {
        db.prepare("UPDATE audit_log SET payload = ? WHERE sandbox_id = ? AND type = 'PROPOSAL_RECEIVED'").run(
          "{not json}",
          sandboxId,
        );
      });
    });
    const list = await app.inject(withCookie(cookie, { method: "GET", url: "/api/audit?limit=200" }));
    expect(list.statusCode).toBe(200);
    const entries = (list.json() as { entries: { payloadParseError?: boolean; payload: unknown }[] }).entries;
    expect(entries).toHaveLength(4);
    const corrupt = entries.find((e) => e.payloadParseError === true);
    expect(corrupt).toBeDefined();
    expect(corrupt!.payload).toEqual({});
  });

  it("verify is read-only: it writes no audit entry", async () => {
    const { app } = await makeApp();
    const { cookie } = await newSandbox(app);
    await app.inject(withCookie(cookie, { method: "GET", url: "/api/audit/verify" }));
    const list = await app.inject(withCookie(cookie, { method: "GET", url: "/api/audit" }));
    expect((list.json() as { entries: unknown[] }).entries).toHaveLength(1);
  });
});

describe("agent API", () => {
  it("runs a scenario and returns its proposals", async () => {
    const { app } = await makeApp();
    const { cookie } = await newSandbox(app);
    const res = await app.inject(
      withCookie(cookie, { method: "POST", url: "/api/agent/run", payload: { scenario: "over_per_tx" } }),
    );
    expect(res.statusCode).toBe(200);
    const body = res.json() as { agentMode: string; proposals: { reason: string }[] };
    expect(body.agentMode).toBe("scripted");
    expect(body.proposals[0]!.reason).toBe("PER_TX_CAP_EXCEEDED");
  });

  it("refuses a bare prompt in scripted mode and an unknown scenario", async () => {
    const { app } = await makeApp();
    const { cookie } = await newSandbox(app);
    const prompt = await app.inject(
      withCookie(cookie, { method: "POST", url: "/api/agent/run", payload: { prompt: "pay acme" } }),
    );
    expect(prompt.statusCode).toBe(422);
    const bad = await app.inject(
      withCookie(cookie, { method: "POST", url: "/api/agent/run", payload: { scenario: "nope" } }),
    );
    expect(bad.statusCode).toBe(422);
  });
});

describe("state API", () => {
  it("returns the full state shape with recent proposals and the audit head", async () => {
    const { app } = await makeApp();
    const { cookie, sandboxId } = await newSandbox(app);
    await app.inject(
      withCookie(cookie, {
        method: "POST",
        url: "/api/proposals",
        payload: { recipient: "acme-corp", amountCents: 10_000, currency: "USD", memo: "" },
      }),
    );
    const res = await app.inject(withCookie(cookie, { method: "GET", url: "/api/state" }));
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.sandboxId).toBe(sandboxId);
    expect(body.perTxCapCents).toBe(50_000);
    expect(body.dailySpentCents).toBe(10_000);
    expect(body.dailyRemainingCents).toBe(90_000);
    expect(body.proposalCount).toBe(1);
    expect(body.paymentTotalCents).toBe(10_000);
    expect(body.agentMode).toBe("scripted");
    expect(body.allowlist).toHaveLength(3);
    expect(body.recentProposals).toHaveLength(1);
    expect(body.auditHead).toEqual({ entries: 4, headHash: expect.any(String) });
    expect(body.windowStart).toBe("2026-11-13T00:00:00.000Z");
    expect(body.windowEnd).toBe("2026-11-14T00:00:00.000Z");
  });
});

describe("unknown routes", () => {
  it("returns the 404 envelope for unknown paths and mutations on read-only resources", async () => {
    const { app } = await makeApp();
    const { cookie } = await newSandbox(app);
    for (const opts of [
      { method: "GET", url: "/api/nope" },
      { method: "POST", url: "/api/audit" },
      { method: "POST", url: "/api/decisions" },
      { method: "DELETE", url: "/api/payments/abc" },
      { method: "PUT", url: "/api/audit/verify" },
    ] as const) {
      const res = await app.inject(withCookie(cookie, opts));
      expect(res.statusCode).toBe(404);
      expect((res.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
    }
  });
});

describe("full journey", () => {
  it("create, run, freeze, verify, reset", async () => {
    const { app } = await makeApp();
    const { cookie } = await newSandbox(app);
    const run = await app.inject(
      withCookie(cookie, { method: "POST", url: "/api/agent/run", payload: { scenario: "happy_path" } }),
    );
    expect((run.json() as { proposals: { outcome: string }[] }).proposals[0]!.outcome).toBe("APPROVED");
    await app.inject(withCookie(cookie, { method: "PUT", url: "/api/config/freeze", payload: { frozen: true } }));
    const frozen = await app.inject(
      withCookie(cookie, { method: "POST", url: "/api/agent/run", payload: { scenario: "frozen" } }),
    );
    expect((frozen.json() as { proposals: { reason: string }[] }).proposals[0]!.reason).toBe("SYSTEM_FROZEN");
    const verify = await app.inject(withCookie(cookie, { method: "GET", url: "/api/audit/verify" }));
    expect((verify.json() as { ok: boolean }).ok).toBe(true);
    const reset = await app.inject(withCookie(cookie, { method: "POST", url: "/api/sandbox/reset" }));
    expect(reset.statusCode).toBe(200);
  });
});
