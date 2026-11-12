import type Database from "better-sqlite3";

import type { ProposalStatus } from "../shared/types.js";

// Typed repositories: the only code that writes SQL outside the audit
// chain module. Every method assumes the caller's transaction (or none,
// for single-statement reads). No business rules live here; the
// services decide, the repositories persist.

export interface SandboxRow {
  id: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  state: string;
}

export interface ConfigRow {
  sandbox_id: string;
  config_version: number;
  per_tx_cap_cents: number;
  daily_cap_cents: number;
  frozen: number;
  updated_at: string;
}

export interface AllowlistRow {
  sandbox_id: string;
  recipient_key: string;
  label: string;
  created_at: string;
}

export interface ProposalRow {
  id: string;
  sandbox_id: string;
  idempotency_key: string | null;
  request_hash: string;
  amount_cents: number;
  currency: string;
  memo: string | null;
  recipient_key: string;
  label: string | null;
  status: ProposalStatus;
  created_at: string;
}

export interface DecisionRow {
  proposal_id: string;
  outcome: "APPROVED" | "REJECTED";
  reasons_json: string;
  snapshot_json: string;
  created_at: string;
}

export interface PaymentRow {
  id: string;
  sandbox_id: string;
  proposal_id: string;
  decision_id: string;
  amount_cents: number;
  recipient_key: string;
  created_at: string;
  executed_at: string;
}

export interface AuditLogRow {
  seq: number;
  sandbox_id: string;
  type: string;
  ts: string;
  actor: string;
  proposal_id: string | null;
  payload: string;
  prev_hash: string;
  hash: string;
}

export function createRepositories(db: Database.Database) {
  return {
    sandboxes: {
      insert(row: SandboxRow): void {
        db.prepare(
          "INSERT INTO sandboxes (id, created_at, last_seen_at, expires_at, state) VALUES (?, ?, ?, ?, ?)",
        ).run(row.id, row.created_at, row.last_seen_at, row.expires_at, row.state);
      },
      getById(id: string): SandboxRow | undefined {
        return db.prepare("SELECT * FROM sandboxes WHERE id = ?").get(id) as SandboxRow | undefined;
      },
      touch(id: string, lastSeenAt: string, expiresAt: string): void {
        db.prepare("UPDATE sandboxes SET last_seen_at = ?, expires_at = ?, state = 'ACTIVE' WHERE id = ?").run(
          lastSeenAt,
          expiresAt,
          id,
        );
      },
      deleteById(id: string): void {
        db.prepare("DELETE FROM sandboxes WHERE id = ?").run(id);
      },
      listExpired(nowIso: string): SandboxRow[] {
        return db.prepare("SELECT * FROM sandboxes WHERE expires_at <= ?").all(nowIso) as SandboxRow[];
      },
    },

    config: {
      insert(row: ConfigRow): void {
        db.prepare(
          "INSERT INTO config (sandbox_id, config_version, per_tx_cap_cents, daily_cap_cents, frozen, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        ).run(row.sandbox_id, row.config_version, row.per_tx_cap_cents, row.daily_cap_cents, row.frozen, row.updated_at);
      },
      getBySandbox(sandboxId: string): ConfigRow | undefined {
        return db.prepare("SELECT * FROM config WHERE sandbox_id = ?").get(sandboxId) as ConfigRow | undefined;
      },
      updateCaps(sandboxId: string, perTx: number, daily: number, updatedAt: string): void {
        db.prepare(
          "UPDATE config SET per_tx_cap_cents = ?, daily_cap_cents = ?, config_version = config_version + 1, updated_at = ? WHERE sandbox_id = ?",
        ).run(perTx, daily, updatedAt, sandboxId);
      },
      updateFrozen(sandboxId: string, frozen: number, updatedAt: string): void {
        db.prepare(
          "UPDATE config SET frozen = ?, config_version = config_version + 1, updated_at = ? WHERE sandbox_id = ?",
        ).run(frozen, updatedAt, sandboxId);
      },
    },

    allowlist: {
      listBySandbox(sandboxId: string): AllowlistRow[] {
        return db
          .prepare("SELECT * FROM allowlist WHERE sandbox_id = ? ORDER BY recipient_key ASC")
          .all(sandboxId) as AllowlistRow[];
      },
      getByKey(sandboxId: string, recipientKey: string): AllowlistRow | undefined {
        return db
          .prepare("SELECT * FROM allowlist WHERE sandbox_id = ? AND recipient_key = ?")
          .get(sandboxId, recipientKey) as AllowlistRow | undefined;
      },
      insert(row: AllowlistRow): void {
        db.prepare(
          "INSERT INTO allowlist (sandbox_id, recipient_key, label, created_at) VALUES (?, ?, ?, ?)",
        ).run(row.sandbox_id, row.recipient_key, row.label, row.created_at);
      },
      remove(sandboxId: string, recipientKey: string): boolean {
        return (
          db.prepare("DELETE FROM allowlist WHERE sandbox_id = ? AND recipient_key = ?").run(sandboxId, recipientKey)
            .changes > 0
        );
      },
      countBySandbox(sandboxId: string): number {
        const row = db
          .prepare("SELECT COUNT(*) AS n FROM allowlist WHERE sandbox_id = ?")
          .get(sandboxId) as { n: number };
        return row.n;
      },
    },

    proposals: {
      insert(row: ProposalRow): void {
        db.prepare(
          `INSERT INTO proposals (id, sandbox_id, idempotency_key, request_hash, amount_cents, currency, memo, recipient_key, label, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          row.id,
          row.sandbox_id,
          row.idempotency_key,
          row.request_hash,
          row.amount_cents,
          row.currency,
          row.memo,
          row.recipient_key,
          row.label,
          row.status,
          row.created_at,
        );
      },
      getById(id: string): ProposalRow | undefined {
        return db.prepare("SELECT * FROM proposals WHERE id = ?").get(id) as ProposalRow | undefined;
      },
      getByIdempotencyKey(sandboxId: string, key: string): ProposalRow | undefined {
        return db
          .prepare("SELECT * FROM proposals WHERE sandbox_id = ? AND idempotency_key = ?")
          .get(sandboxId, key) as ProposalRow | undefined;
      },
      updateStatus(id: string, status: ProposalStatus): void {
        db.prepare("UPDATE proposals SET status = ? WHERE id = ?").run(status, id);
      },
      countBySandbox(sandboxId: string): number {
        const row = db
          .prepare("SELECT COUNT(*) AS n FROM proposals WHERE sandbox_id = ?")
          .get(sandboxId) as { n: number };
        return row.n;
      },
      listRecent(sandboxId: string, limit: number): ProposalRow[] {
        return db
          .prepare("SELECT * FROM proposals WHERE sandbox_id = ? ORDER BY created_at DESC, id DESC LIMIT ?")
          .all(sandboxId, limit) as ProposalRow[];
      },
    },

    decisions: {
      insert(row: DecisionRow): void {
        db.prepare(
          "INSERT INTO decisions (proposal_id, outcome, reasons_json, snapshot_json, created_at) VALUES (?, ?, ?, ?, ?)",
        ).run(row.proposal_id, row.outcome, row.reasons_json, row.snapshot_json, row.created_at);
      },
      getByProposalId(proposalId: string): DecisionRow | undefined {
        return db.prepare("SELECT * FROM decisions WHERE proposal_id = ?").get(proposalId) as DecisionRow | undefined;
      },
    },

    payments: {
      insert(row: PaymentRow): void {
        db.prepare(
          `INSERT INTO payments (id, sandbox_id, proposal_id, decision_id, amount_cents, recipient_key, created_at, executed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          row.id,
          row.sandbox_id,
          row.proposal_id,
          row.decision_id,
          row.amount_cents,
          row.recipient_key,
          row.created_at,
          row.executed_at,
        );
      },
      getByProposalId(proposalId: string): PaymentRow | undefined {
        return db.prepare("SELECT * FROM payments WHERE proposal_id = ?").get(proposalId) as PaymentRow | undefined;
      },
      /** Spend in [startIso, endIso): executed_at on or after start, strictly before end. */
      sumForWindow(sandboxId: string, startIso: string, endIso: string): number {
        const row = db
          .prepare(
            "SELECT COALESCE(SUM(amount_cents), 0) AS total FROM payments WHERE sandbox_id = ? AND executed_at >= ? AND executed_at < ?",
          )
          .get(sandboxId, startIso, endIso) as { total: number };
        return row.total;
      },
      countBySandbox(sandboxId: string): number {
        const row = db
          .prepare("SELECT COUNT(*) AS n FROM payments WHERE sandbox_id = ?")
          .get(sandboxId) as { n: number };
        return row.n;
      },
      totalBySandbox(sandboxId: string): number {
        const row = db
          .prepare("SELECT COALESCE(SUM(amount_cents), 0) AS total FROM payments WHERE sandbox_id = ?")
          .get(sandboxId) as { total: number };
        return row.total;
      },
    },

    audit: {
      countBySandbox(sandboxId: string): number {
        const row = db
          .prepare("SELECT COUNT(*) AS n FROM audit_log WHERE sandbox_id = ?")
          .get(sandboxId) as { n: number };
        return row.n;
      },
      listBySandbox(sandboxId: string): AuditLogRow[] {
        return db
          .prepare("SELECT * FROM audit_log WHERE sandbox_id = ? ORDER BY seq ASC")
          .all(sandboxId) as AuditLogRow[];
      },
      headBySandbox(sandboxId: string): { entries: number; headHash: string | null } {
        const row = db
          .prepare("SELECT COUNT(*) AS n, MAX(seq) AS maxSeq FROM audit_log WHERE sandbox_id = ?")
          .get(sandboxId) as { n: number; maxSeq: number | null };
        if (row.maxSeq === null) return { entries: 0, headHash: null };
        const head = db.prepare("SELECT hash FROM audit_log WHERE seq = ?").get(row.maxSeq) as {
          hash: string;
        };
        return { entries: row.n, headHash: head.hash };
      },
    },
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
