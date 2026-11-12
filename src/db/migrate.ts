import { readFileSync } from "node:fs";

import Database from "better-sqlite3";

// Database setup: one synchronous single-writer SQLite connection.
// WAL + FULL synchronous for durability at demo scale, foreign keys on,
// and a 5s busy timeout so a contended writer waits instead of failing
// outright. The schema lives in schema.sql; the build copies it next to
// the compiled output so this loader works identically in dev, tests,
// and the built server.

export const SCHEMA_VERSION = 2;

function loadSchemaSql(): string {
  return readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
}

function loadMigrationSql(version: number): string {
  return readFileSync(new URL(`./migrations/${String(version).padStart(3, "0")}.sql`, import.meta.url), "utf8");
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
  // Apply pending versions in order, one row per version. A fresh
  // database gets the full schema (v1) plus every later migration;
  // an existing database gets only what it lacks. CREATE ... IF NOT
  // EXISTS never replaces an object that already exists, so a
  // changed trigger or index always needs its own migration file.
  for (let version = current + 1; version <= SCHEMA_VERSION; version++) {
    const sql = version === 1 ? loadSchemaSql() : loadMigrationSql(version);
    withImmediateTransaction(db, () => {
      db.exec(sql);
      db.prepare("INSERT INTO schema_version (version, applied_at) VALUES (?, ?)").run(
        version,
        new Date().toISOString(),
      );
    });
  }
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

/**
 * Run `fn` with the purge flag on, restoring it afterwards. Only the
 * sandbox purge path and the flag-gated tamper demo may use this.
 * Must run inside a transaction: the flag flip is a plain UPDATE, so
 * flipping it outside a transaction would auto-commit and stay
 * visible to any other connection until the work finished. Inside a
 * transaction the flip is only ever visible to this connection, and
 * a rollback restores the flag with everything else.
 */
export function withPurgeMode<T>(db: Database.Database, fn: () => T): T {
  if (!db.inTransaction) {
    throw new Error("withPurgeMode must run inside a transaction");
  }
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
