import { createHash } from "node:crypto";

import type Database from "better-sqlite3";

import { canonicalJson } from "../../shared/canonicalJson.js";
import type { Actor, AuditType, JsonValue } from "../../shared/types.js";

// The audit hash chain. Each entry's hash covers the previous hash plus
// the canonical JSON of the entry itself, so changing any field of any
// entry breaks every hash after it. The chain is per-sandbox: the first
// entry of a sandbox has a prev_hash of 64 zeros. Seq is a global
// AUTOINCREMENT, so entries of one sandbox interleave with others';
// verifyChain therefore checks strictly increasing seqs and hash links,
// not contiguity. Tail truncation is NOT detected: deleting entries
// from the end leaves a shorter valid chain. The UI says "verifiable",
// never "tamper-proof".

export const GENESIS_PREV_HASH = "0".repeat(64);

export interface ChainEntry {
  seq: number;
  type: AuditType;
  ts: string;
  actor: Actor;
  proposalId: string | null;
  payload: Record<string, JsonValue>;
}

/** SHA-256 hex of (prevHash + canonical JSON of the entry). The concatenation order is part of the format: verifiers must reproduce it exactly. */
export function computeHash(prevHash: string, entry: ChainEntry): string {
  const body = canonicalJson({
    seq: entry.seq,
    type: entry.type,
    ts: entry.ts,
    actor: entry.actor,
    proposal_id: entry.proposalId,
    payload: entry.payload,
  });
  return createHash("sha256").update(prevHash + body, "utf8").digest("hex");
}

export interface AppendEntry {
  type: AuditType;
  ts: string;
  actor: Actor;
  proposalId: string | null;
  payload: Record<string, JsonValue>;
}

/**
 * Append one entry to a sandbox's chain, inside the caller's
 * transaction. The seq is assigned here (max + 1) rather than left to
 * AUTOINCREMENT, because the hash covers the seq and must be computed
 * before the insert. The chain-link trigger re-checks the prev_hash on
 * insert, so a caller that bypasses this function cannot fork a chain
 * silently.
 */
export function appendAudit(
  db: Database.Database,
  sandboxId: string,
  entry: AppendEntry,
): { seq: number; hash: string } {
  const tail = db
    .prepare("SELECT hash FROM audit_log WHERE sandbox_id = ? ORDER BY seq DESC LIMIT 1")
    .get(sandboxId) as { hash: string } | undefined;
  const prevHash = tail?.hash ?? GENESIS_PREV_HASH;
  const seqRow = db.prepare("SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM audit_log").get() as {
    next: number;
  };
  const seq = seqRow.next;
  const hash = computeHash(prevHash, { seq, ...entry });
  db.prepare(
    `INSERT INTO audit_log (seq, sandbox_id, type, ts, actor, proposal_id, payload, prev_hash, hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    seq,
    sandboxId,
    entry.type,
    entry.ts,
    entry.actor,
    entry.proposalId,
    canonicalJson(entry.payload),
    prevHash,
    hash,
  );
  return { seq, hash };
}

export type VerifyResult =
  | { ok: true; entries: number; headHash: string | null }
  | { ok: false; entries: number; headHash: string | null; brokenAtSeq: number; reason: string };

interface AuditRow {
  seq: number;
  type: AuditType;
  ts: string;
  actor: Actor;
  proposal_id: string | null;
  payload: string;
  prev_hash: string;
  hash: string;
}

/** Verify a sandbox's chain, failing fast at the first mismatch. Reads only; never writes. */
export function verifyChain(db: Database.Database, sandboxId: string): VerifyResult {
  const rows = db
    .prepare(
      "SELECT seq, type, ts, actor, proposal_id, payload, prev_hash, hash FROM audit_log WHERE sandbox_id = ? ORDER BY seq ASC",
    )
    .all(sandboxId) as AuditRow[];
  let prevHash = GENESIS_PREV_HASH;
  let prevSeq = 0;
  for (const row of rows) {
    if (row.seq <= prevSeq) {
      return {
        ok: false,
        entries: rows.length,
        headHash: rows[rows.length - 1]?.hash ?? null,
        brokenAtSeq: row.seq,
        reason: "sequence numbers are not strictly increasing",
      };
    }
    if (row.prev_hash !== prevHash) {
      return {
        ok: false,
        entries: rows.length,
        headHash: rows[rows.length - 1]?.hash ?? null,
        brokenAtSeq: row.seq,
        reason: "prev_hash does not match the previous entry's hash",
      };
    }
    let payload: Record<string, JsonValue>;
    try {
      payload = JSON.parse(row.payload) as Record<string, JsonValue>;
    } catch {
      return {
        ok: false,
        entries: rows.length,
        headHash: rows[rows.length - 1]?.hash ?? null,
        brokenAtSeq: row.seq,
        reason: "payload is not valid JSON",
      };
    }
    // The recompute can throw on a stored payload that parses but is
    // not canonical data (a float, absurd nesting): only a corrupted
    // database can hold one, since appendAudit canonicalizes at write
    // time. The verifier answers "broken", never throws, so one bad
    // row cannot take down verification for the whole sandbox.
    let recomputed: string;
    try {
      recomputed = computeHash(row.prev_hash, {
        seq: row.seq,
        type: row.type,
        ts: row.ts,
        actor: row.actor,
        proposalId: row.proposal_id,
        payload,
      });
    } catch {
      return {
        ok: false,
        entries: rows.length,
        headHash: rows[rows.length - 1]?.hash ?? null,
        brokenAtSeq: row.seq,
        reason: "payload is not canonical JSON data",
      };
    }
    if (recomputed !== row.hash) {
      return {
        ok: false,
        entries: rows.length,
        headHash: rows[rows.length - 1]?.hash ?? null,
        brokenAtSeq: row.seq,
        reason: "stored hash does not match the recomputed hash",
      };
    }
    prevHash = row.hash;
    prevSeq = row.seq;
  }
  return { ok: true, entries: rows.length, headHash: rows.length > 0 ? prevHash : null };
}
