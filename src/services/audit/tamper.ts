import type Database from "better-sqlite3";

import { withPurgeMode } from "../../db/migrate.js";

// Demo-only chain tampering (task 8.6). Replaces one entry's payload
// with a marker, reusing the privileged purge-mode bypass the sandbox
// reset uses to delete rows. The stored hash is deliberately left
// alone, so verification fails at exactly this seq with a hash
// mismatch. Only reachable through the flag-gated /api/_demo/tamper
// route; the normal API surface has no mutation path for audit
// entries, and with the flag off the route does not exist.

export function tamperAuditEntry(db: Database.Database, sandboxId: string, seq: number): boolean {
  const row = db
    .prepare("SELECT seq FROM audit_log WHERE sandbox_id = ? AND seq = ?")
    .get(sandboxId, seq) as { seq: number } | undefined;
  if (!row) return false;
  withPurgeMode(db, () => {
    db.prepare("UPDATE audit_log SET payload = ? WHERE sandbox_id = ? AND seq = ?").run(
      JSON.stringify({ tampered: true, note: "this entry was edited by the tamper demo" }),
      sandboxId,
      seq,
    );
  });
  return true;
}
