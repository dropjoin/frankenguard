import { readFileSync } from "node:fs";

import Database from "better-sqlite3";

// Database setup: one synchronous single-writer SQLite connection.
// WAL + FULL synchronous for durability at demo scale, foreign keys on,
// and a 5s busy timeout so a contended writer waits instead of failing
// outright. The schema lives in schema.sql; the build copies it next to
// the compiled output so this loader works identically in dev, tests,
// and the built server.

export const SCHEMA_VERSION = 1;

function loadSchemaSql(): string {
  return readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
}

export function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version    INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
  const row = db.prepare("SELECT MAX(version) AS v FROM schema_version").get() as { v: number | null };
  const current = row.v ?? 0;
  if (current >= SCHEMA_VERSION) return;
  withImmediateTransaction(db, () => {
    db.exec(loadSchemaSql());
    db.prepare("INSERT INTO schema_version (version, applied_at) VALUES (?, ?)").run(
      SCHEMA_VERSION,
      new Date().toISOString(),
    );
  });
}

export function openDb(path: string): Database.Database {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = FULL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  migrate(db);
  // A crash mid-purge could leave the purge flag on. Reset it on every
  // open: this process is the only writer, so no legitimate purge is
  // ever in flight when a connection opens.
  db.prepare("UPDATE purge_mode SET active = 0 WHERE id = 1").run();
  return db;
}

/** Run `fn` with the purge flag on, restoring it afterwards. Only the sandbox purge path may use this. */
export function withPurgeMode<T>(db: Database.Database, fn: () => T): T {
  db.prepare("UPDATE purge_mode SET active = 1 WHERE id = 1").run();
  try {
    return fn();
  } finally {
    db.prepare("UPDATE purge_mode SET active = 0 WHERE id = 1").run();
  }
}

/**
 * Run `fn` inside BEGIN IMMEDIATE and commit, rolling back on any
 * error. IMMEDIATE takes the writer lock up front, which is what makes
 * the daily-cap check atomic: two concurrent submits serialize instead
 * of both reading the same spent total. Callers must not nest this:
 * repositories and the chain module run inside the caller's
 * transaction and never open their own.
 */
export function withImmediateTransaction<T>(db: Database.Database, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    try {
      db.exec("COMMIT");
    } catch (commitError) {
      if (db.inTransaction) db.exec("ROLLBACK");
      throw commitError;
    }
    return result;
  } catch (error) {
    if (db.inTransaction) db.exec("ROLLBACK");
    throw error;
  }
}
