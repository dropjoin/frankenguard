import { describe, expect, it } from "vitest";

import { createRepositories } from "../../src/db/repositories.js";
import {
  createSandbox,
  getSandbox,
  resetSandbox,
  SEED_ALLOWLIST,
  sweepExpired,
  touchSandbox,
} from "../../src/services/sandbox.js";
import { verifyChain } from "../../src/services/audit/chain.js";
import { FakeClock } from "../../src/shared/clock.js";
import { openTestDb } from "../db/helpers.js";

describe("sandbox lifecycle", () => {
  it("seeds config, allowlist, and a SANDBOX_CREATED audit entry", () => {
    const db = openTestDb();
    const clock = new FakeClock("2026-11-13T00:00:00.000Z");
    const sandbox = createSandbox(db, clock);
    expect(sandbox.id).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(sandbox.createdAt).toBe("2026-11-13T00:00:00.000Z");
    expect(sandbox.expiresAt).toBe("2026-11-13T01:00:00.000Z");

    const repos = createRepositories(db);
    expect(repos.config.getBySandbox(sandbox.id)).toMatchObject({
      config_version: 1,
      per_tx_cap_cents: 50000,
      daily_cap_cents: 100000,
      frozen: 0,
    });
    expect(repos.allowlist.listBySandbox(sandbox.id).map((r) => r.recipient_key)).toEqual(
      SEED_ALLOWLIST.map((s) => s.key).sort(),
    );
    const entries = db
      .prepare("SELECT seq, type, prev_hash FROM audit_log WHERE sandbox_id = ?")
      .all(sandbox.id) as { seq: number; type: string; prev_hash: string }[];
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ type: "SANDBOX_CREATED", prev_hash: "0".repeat(64) });
    expect(verifyChain(db, sandbox.id)).toMatchObject({ ok: true, entries: 1 });
  });

  it("touch extends the idle expiry but never past the 4-hour absolute cap", () => {
    const db = openTestDb();
    const clock = new FakeClock("2026-11-13T00:00:00.000Z");
    const sandbox = createSandbox(db, clock);

    // Keep the sandbox alive with touches every 50 minutes. Each touch
    // extends the idle expiry by an hour, until the 4-hour absolute
    // cap (04:00) binds.
    clock.advanceMinutes(50);
    expect(touchSandbox(db, clock, sandbox.id)?.expiresAt).toBe("2026-11-13T01:50:00.000Z");
    clock.advanceMinutes(50);
    expect(touchSandbox(db, clock, sandbox.id)?.expiresAt).toBe("2026-11-13T02:40:00.000Z");
    clock.advanceMinutes(50);
    expect(touchSandbox(db, clock, sandbox.id)?.expiresAt).toBe("2026-11-13T03:30:00.000Z");
    clock.advanceMinutes(50); // 03:20: idle expiry would be 04:20, absolute cap is 04:00
    expect(touchSandbox(db, clock, sandbox.id)?.expiresAt).toBe("2026-11-13T04:00:00.000Z");

    clock.advanceMinutes(50); // 04:10, past the absolute cap
    expect(touchSandbox(db, clock, sandbox.id)).toBeNull();
  });

  it("never resurrects an expired sandbox", () => {
    const db = openTestDb();
    const clock = new FakeClock("2026-11-13T00:00:00.000Z");
    const sandbox = createSandbox(db, clock);
    clock.advanceMinutes(61);
    expect(touchSandbox(db, clock, sandbox.id)).toBeNull();
    expect(getSandbox(db, sandbox.id)?.expiresAt).toBe("2026-11-13T01:00:00.000Z");
  });

  it("returns null for unknown sandbox ids", () => {
    const db = openTestDb();
    const clock = new FakeClock("2026-11-13T00:00:00.000Z");
    expect(touchSandbox(db, clock, "nope")).toBeNull();
    expect(getSandbox(db, "nope")).toBeNull();
  });

  it("clamps a backward clock jump instead of rewinding the sandbox", () => {
    const db = openTestDb();
    const clock = new FakeClock("2026-11-13T00:00:00.000Z");
    const sandbox = createSandbox(db, clock);
    clock.advanceMinutes(30);
    touchSandbox(db, clock, sandbox.id);
    clock.set("2026-11-13T00:05:00.000Z"); // clock jumps backward
    const touched = touchSandbox(db, clock, sandbox.id);
    // last_seen stays at 00:30 (the later time), expiry extends from there.
    expect(touched?.lastSeenAt).toBe("2026-11-13T00:30:00.000Z");
    expect(touched?.expiresAt).toBe("2026-11-13T01:30:00.000Z");
  });

  it("sweep removes only expired sandboxes, with all their rows", () => {
    const db = openTestDb();
    const clock = new FakeClock("2026-11-13T00:00:00.000Z");
    const old = createSandbox(db, clock);
    clock.advanceMinutes(30);
    const fresh = createSandbox(db, clock);
    clock.advanceMinutes(45); // old expires at 01:00, fresh at 01:30; now is 01:15
    expect(sweepExpired(db, clock)).toBe(1);
    expect(getSandbox(db, old.id)).toBeNull();
    expect(getSandbox(db, fresh.id)).not.toBeNull();
    expect(db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE sandbox_id = ?").get(old.id)).toEqual({ n: 0 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE sandbox_id = ?").get(fresh.id)).toEqual({ n: 1 });
  });

  it("reset purges the old sandbox and creates a fresh one", () => {
    const db = openTestDb();
    const clock = new FakeClock("2026-11-13T00:00:00.000Z");
    const old = createSandbox(db, clock);
    const fresh = resetSandbox(db, clock, old.id);
    expect(fresh.id).not.toBe(old.id);
    expect(getSandbox(db, old.id)).toBeNull();
    expect(db.prepare("SELECT COUNT(*) AS n FROM config WHERE sandbox_id = ?").get(old.id)).toEqual({ n: 0 });
    const repos = createRepositories(db);
    expect(repos.config.getBySandbox(fresh.id)).toMatchObject({ config_version: 1, frozen: 0 });
    expect(repos.allowlist.countBySandbox(fresh.id)).toBe(3);
  });
});
