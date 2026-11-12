import type Database from "better-sqlite3";

import { openDb } from "../../src/db/migrate.js";

/** A fresh migrated in-memory database. Each test gets its own: no shared state, no cleanup ordering bugs. */
export function openTestDb(): Database.Database {
  return openDb(":memory:");
}
