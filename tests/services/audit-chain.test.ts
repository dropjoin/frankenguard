import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { withImmediateTransaction, withPurgeMode } from "../../src/db/migrate.js";
import { appendAudit, computeHash, GENESIS_PREV_HASH, verifyChain } from "../../src/services/audit/chain.js";
import { canonicalJson } from "../../src/shared/canonicalJson.js";
import { openTestDb } from "../db/helpers.js";

function seedSandbox(db: ReturnType<typeof openTestDb>, id = "sb-1"): void {
  db.prepare(
    "INSERT INTO sandboxes (id, created_at, last_seen_at, expires_at, state) VALUES (?, 't', 't', 't', 'ACTIVE')",
  ).run(id);
}

describe("computeHash", () => {
  it("matches an independently computed SHA-256 vector", () => {
    const entry = {
      seq: 1,
      type: "SANDBOX_CREATED" as const,
      ts: "2026-11-13T00:00:00.000Z",
      actor: "system" as const,
      proposalId: null,
      payload: { configVersion: 1 },
    };
    const expected = createHash("sha256")
      .update(
        GENESIS_PREV_HASH +
          canonicalJson({
            seq: 1,
            type: "SANDBOX_CREATED",
            ts: "2026-11-13T00:00:00.000Z",
            actor: "system",
            proposal_id: null,
            payload: { configVersion: 1 },
          }),
        "utf8",
      )
      .digest("hex");
    expect(computeHash(GENESIS_PREV_HASH, entry)).toBe(expected);
  });

  it("changes when any covered field changes", () => {
    const base = {
      seq: 1,
      type: "SANDBOX_CREATED" as const,
      ts: "2026-11-13T00:00:00.000Z",
      actor: "system" as const,
      proposalId: null,
      payload: {},
    };
    const hash = computeHash(GENESIS_PREV_HASH, base);
    expect(computeHash(GENESIS_PREV_HASH, { ...base, seq: 2 })).not.toBe(hash);
    expect(computeHash(GENESIS_PREV_HASH, { ...base, payload: { x: 1 } })).not.toBe(hash);
    expect(computeHash("f".repeat(64), base)).not.toBe(hash);
  });
});

describe("appendAudit + verifyChain", () => {
  it("starts a chain with the 64-zero genesis prev_hash", () => {
    const db = openTestDb();
    seedSandbox(db);
    const { seq, hash } = appendAudit(db, "sb-1", {
      type: "SANDBOX_CREATED",
      ts: "2026-11-13T00:00:00.000Z",
      actor: "system",
      proposalId: null,
      payload: {},
    });
    expect(seq).toBe(1);
    const row = db.prepare("SELECT prev_hash, hash FROM audit_log WHERE seq = ?").get(seq) as {
      prev_hash: string;
      hash: string;
    };
    expect(row.prev_hash).toBe("0".repeat(64));
    expect(row.hash).toBe(hash);
  });

  it("links entries and verifies a chain of many entries", () => {
    const db = openTestDb();
    seedSandbox(db);
    for (let i = 0; i < 25; i++) {
      appendAudit(db, "sb-1", {
        type: "PROPOSAL_RECEIVED",
        ts: "2026-11-13T00:00:00.000Z",
        actor: "agent:scripted",
        proposalId: null,
        payload: { i },
      });
    }
    const result = verifyChain(db, "sb-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entries).toBe(25);
      expect(result.headHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("returns ok with zero entries for an empty chain", () => {
    const db = openTestDb();
    seedSandbox(db);
    expect(verifyChain(db, "sb-1")).toEqual({ ok: true, entries: 0, headHash: null });
  });

  it("reports the exact broken sequence when a middle row is altered", () => {
    const db = openTestDb();
    seedSandbox(db);
    for (let i = 0; i < 5; i++) {
      appendAudit(db, "sb-1", {
        type: "PROPOSAL_RECEIVED",
        ts: "2026-11-13T00:00:00.000Z",
        actor: "agent:scripted",
        proposalId: null,
        payload: { amountCents: 1000 },
      });
    }
    // Tamper: rewrite a payload through a privileged connection path.
    // The no-update trigger blocks UPDATE, so the tamper goes through
    // direct file-level manipulation simulated here by dropping and
    // recreating the trigger, exactly as a hostile DBA would.
    db.exec("DROP TRIGGER audit_no_update");
    db.prepare("UPDATE audit_log SET payload = ? WHERE seq = 2").run('{"amountCents":999999}');
    db.exec(`CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_log
      BEGIN SELECT RAISE(ABORT, 'audit_log is append-only: updates are forbidden'); END;`);
    const result = verifyChain(db, "sb-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.brokenAtSeq).toBe(2);
      expect(result.reason).toMatch(/recomputed hash/);
    }
  });

  it("reports broken, never throws, when a stored payload is not canonical JSON data", () => {
    const db = openTestDb();
    seedSandbox(db);
    appendAudit(db, "sb-1", {
      type: "SANDBOX_CREATED",
      ts: "2026-11-13T00:00:00.000Z",
      actor: "system",
      proposalId: null,
      payload: {},
    });
    // A float can only reach the stored payload by corrupting the DB
    // file directly: appendAudit canonicalizes at write time. The
    // verifier must still answer "broken" instead of crashing.
    withImmediateTransaction(db, () => {
      withPurgeMode(db, () => {
        db.prepare("UPDATE audit_log SET payload = ? WHERE seq = 1").run('{"amountCents": 1.5, "x": true}');
      });
    });
    const result = verifyChain(db, "sb-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.brokenAtSeq).toBe(1);
      expect(result.reason).toBe("payload is not canonical JSON data");
    }
  });

  it("reports broken, never throws, when a stored payload is nested past the depth limit", () => {
    const db = openTestDb();
    seedSandbox(db);
    appendAudit(db, "sb-1", {
      type: "SANDBOX_CREATED",
      ts: "2026-11-13T00:00:00.000Z",
      actor: "system",
      proposalId: null,
      payload: {},
    });
    let deep: unknown = [];
    for (let i = 0; i < 3000; i++) deep = [deep];
    withImmediateTransaction(db, () => {
      withPurgeMode(db, () => {
        db.prepare("UPDATE audit_log SET payload = ? WHERE seq = 1").run(JSON.stringify(deep));
      });
    });
    const result = verifyChain(db, "sb-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.brokenAtSeq).toBe(1);
      expect(result.reason).toBe("payload is not canonical JSON data");
    }
  });

  it("does NOT detect tail truncation, by design (documented limitation)", () => {
    const db = openTestDb();
    seedSandbox(db);
    for (let i = 0; i < 5; i++) {
      appendAudit(db, "sb-1", {
        type: "PROPOSAL_RECEIVED",
        ts: "2026-11-13T00:00:00.000Z",
        actor: "agent:scripted",
        proposalId: null,
        payload: { i },
      });
    }
    withImmediateTransaction(db, () => {
      withPurgeMode(db, () => {
        db.prepare("DELETE FROM audit_log WHERE seq >= 4").run();
      });
    });
    const result = verifyChain(db, "sb-1");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.entries).toBe(3);
  });

  it("keeps interleaved sandbox chains independent", () => {
    const db = openTestDb();
    seedSandbox(db, "sb-1");
    seedSandbox(db, "sb-2");
    appendAudit(db, "sb-1", { type: "SANDBOX_CREATED", ts: "t", actor: "system", proposalId: null, payload: {} });
    appendAudit(db, "sb-2", { type: "SANDBOX_CREATED", ts: "t", actor: "system", proposalId: null, payload: {} });
    appendAudit(db, "sb-1", { type: "PROPOSAL_RECEIVED", ts: "t", actor: "agent:scripted", proposalId: null, payload: {} });
    expect(verifyChain(db, "sb-1")).toMatchObject({ ok: true, entries: 2 });
    expect(verifyChain(db, "sb-2")).toMatchObject({ ok: true, entries: 1 });
  });
});
