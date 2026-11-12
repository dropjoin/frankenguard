import { openDb } from "../src/db/migrate.js";
import { createSandbox, type Sandbox } from "../src/services/sandbox.js";
import { FakeClock } from "../src/shared/clock.js";

/** A migrated in-memory database with one fresh sandbox, at a fixed noon-UTC clock. */
export function makeTestDb(startIso = "2026-11-13T12:00:00.000Z"): {
  db: ReturnType<typeof openDb>;
  clock: FakeClock;
  sandbox: Sandbox;
} {
  const db = openDb(":memory:");
  const clock = new FakeClock(startIso);
  const sandbox = createSandbox(db, clock);
  return { db, clock, sandbox };
}
