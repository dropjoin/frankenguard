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

  it("records the schema version and re-running is a no-op", () => {
    const db = openDb(":memory:");
    const before = db.prepare("SELECT version FROM schema_version").all();
    expect(before).toEqual([{ version: SCHEMA_VERSION }]);
    migrate(db);
    migrate(db);
    const after = db.prepare("SELECT version FROM schema_version").all();
    expect(after).toEqual([{ version: SCHEMA_VERSION }]);
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
