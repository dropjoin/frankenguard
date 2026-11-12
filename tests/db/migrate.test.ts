import { describe, expect, it } from "vitest";

import { migrate, openDb, SCHEMA_VERSION } from "../../src/db/migrate.js";

describe("migrate", () => {
  it("creates every table on a fresh database", () => {
    const db = openDb(":memory:");
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all() as { name: string }[];
    expect(tables.map((t) => t.name)).toEqual([
      "allowlist",
      "audit_log",
      "config",
      "decisions",
      "payments",
      "proposals",
      "purge_mode",
      "sandboxes",
      "schema_version",
    ]);
    const triggers = db.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' ORDER BY name").all() as {
      name: string;
    }[];
    expect(triggers.map((t) => t.name)).toContain("audit_no_update");
    expect(triggers.map((t) => t.name)).toContain("audit_chain_link");
    expect(triggers.map((t) => t.name)).toContain("payments_require_approved");
    expect(triggers.map((t) => t.name)).toContain("proposals_status_once");
  });

  it("records every applied version and re-running is a no-op", () => {
    const db = openDb(":memory:");
    const before = db.prepare("SELECT version FROM schema_version ORDER BY version").all();
    expect(before).toEqual([{ version: 1 }, { version: SCHEMA_VERSION }]);
    migrate(db);
    migrate(db);
    const after = db.prepare("SELECT version FROM schema_version ORDER BY version").all();
    expect(after).toEqual([{ version: 1 }, { version: SCHEMA_VERSION }]);
  });

  it("upgrades a v1 database: the old unconditional update trigger is replaced", () => {
    const db = openDb(":memory:");
    // Rewind to the v1 state: the old trigger with no purge
    // exemption, and only the v1 version row.
    db.exec("DROP TRIGGER audit_no_update");
    db.exec(`CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_log BEGIN
      SELECT RAISE(ABORT, 'audit_log is append-only: updates are forbidden');
    END;`);
    db.prepare("DELETE FROM schema_version WHERE version = ?").run(SCHEMA_VERSION);
    migrate(db);
    const trigger = db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = 'audit_no_update'")
      .get() as { sql: string };
    expect(trigger.sql).toContain("purge_mode");
    const versions = db.prepare("SELECT version FROM schema_version ORDER BY version").all();
    expect(versions).toEqual([{ version: 1 }, { version: SCHEMA_VERSION }]);
  });

  it("still forbids audit updates outside the purge bypass", () => {
    const db = openDb(":memory:");
    db.prepare("INSERT INTO sandboxes (id, created_at, last_seen_at, expires_at) VALUES ('s1', 't', 't', 't')").run();
    db.prepare(
      "INSERT INTO audit_log (seq, sandbox_id, type, ts, actor, proposal_id, payload, prev_hash, hash) VALUES (1, 's1', 'SANDBOX_CREATED', 't', 'system', NULL, '{}', ?, 'h')",
    ).run("0".repeat(64));
    expect(() => db.prepare("UPDATE audit_log SET payload = '{}' WHERE seq = 1").run()).toThrow(/append-only/);
  });

  it("enables foreign keys", () => {
    const db = openDb(":memory:");
    const row = db.pragma("foreign_keys", { simple: true }) as unknown as number;
    expect(row).toBe(1);
  });

  it("rejects rows that violate foreign keys", () => {
    const db = openDb(":memory:");
    expect(() =>
      db
        .prepare("INSERT INTO config (sandbox_id, per_tx_cap_cents, daily_cap_cents, updated_at) VALUES (?, 1, 1, 'x')")
        .run("no-such-sandbox"),
    ).toThrow(/FOREIGN KEY/);
  });
});
