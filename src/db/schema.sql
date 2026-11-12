-- FrankenGuard schema (design 3.1), plus the integrity triggers from
-- design 3.3 and the idempotency index the service layer relies on.
-- Applied by db/migrate.ts; every statement is idempotent.

CREATE TABLE IF NOT EXISTS schema_version (
  version    INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sandboxes (
  id            TEXT PRIMARY KEY,  -- random 128-bit, base64url
  created_at    TEXT NOT NULL,     -- ISO 8601 UTC
  last_seen_at  TEXT NOT NULL,
  expires_at    TEXT NOT NULL,     -- created + 60 min idle, capped at +4 h
  state         TEXT NOT NULL DEFAULT 'ACTIVE',
  CHECK (state IN ('ACTIVE', 'EXPIRING', 'EXPIRED'))
);

CREATE TABLE IF NOT EXISTS config (
  sandbox_id        TEXT PRIMARY KEY REFERENCES sandboxes(id),
  config_version    INTEGER NOT NULL DEFAULT 1,
  per_tx_cap_cents  INTEGER NOT NULL,    -- default 50,000 ($500)
  daily_cap_cents   INTEGER NOT NULL,    -- default 100,000 ($1000)
  frozen            INTEGER NOT NULL DEFAULT 0,  -- 0/1, single writer, no cache
  updated_at        TEXT NOT NULL,       -- ISO 8601 UTC
  FOREIGN KEY (sandbox_id) REFERENCES sandboxes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS allowlist (
  sandbox_id    TEXT NOT NULL REFERENCES sandboxes(id) ON DELETE CASCADE,
  recipient_key TEXT NOT NULL,  -- normalized identifier (NFKC, lowercase, trim, 1-64)
  label         TEXT NOT NULL,  -- the display name
  created_at    TEXT NOT NULL,
  PRIMARY KEY (sandbox_id, recipient_key)
);

CREATE TABLE IF NOT EXISTS proposals (
  id              TEXT PRIMARY KEY,  -- ULID
  sandbox_id      TEXT NOT NULL REFERENCES sandboxes(id) ON DELETE CASCADE,
  idempotency_key TEXT, -- client-supplied key, unique per sandbox when present
  request_hash    TEXT NOT NULL,  -- SHA-256 hex of canonical proposal JSON
  amount_cents    INTEGER NOT NULL,
  currency        TEXT NOT NULL,
  memo            TEXT,
  recipient_key   TEXT NOT NULL,
  label           TEXT,
  status          TEXT NOT NULL DEFAULT 'RECEIVED',
  created_at      TEXT NOT NULL,
  CHECK (status IN ('RECEIVED', 'EXECUTED', 'BLOCKED'))
);

-- Same key + same sandbox must never yield two proposals. The service
-- checks first inside BEGIN IMMEDIATE; this index is the backstop.
CREATE UNIQUE INDEX IF NOT EXISTS idx_proposals_idempotency
  ON proposals (sandbox_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS decisions (
  proposal_id   TEXT PRIMARY KEY REFERENCES proposals(id) ON DELETE CASCADE,
  outcome       TEXT NOT NULL CHECK (outcome IN ('APPROVED', 'REJECTED')),
  reasons_json  TEXT NOT NULL, -- JSON array of Reason
  snapshot_json TEXT NOT NULL, -- JSON of ConfigSnapshot, or JSON null for ENGINE_ERROR
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id            TEXT PRIMARY KEY,
  sandbox_id    TEXT NOT NULL REFERENCES sandboxes(id) ON DELETE CASCADE,
  proposal_id   TEXT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  decision_id   TEXT NOT NULL REFERENCES decisions(proposal_id) ON DELETE CASCADE,
  amount_cents  INTEGER NOT NULL,
  recipient_key TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  executed_at   TEXT NOT NULL  -- UTC timestamp (UTC Day Window)
);

CREATE TABLE IF NOT EXISTS audit_log (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,  -- global, 1, 2, 3, ...
  sandbox_id TEXT NOT NULL REFERENCES sandboxes(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  ts         TEXT NOT NULL, -- ISO 8601 UTC
  actor      TEXT NOT NULL, -- "operator" | "operator:manual" | "agent:scripted" | "system"
  proposal_id TEXT REFERENCES proposals(id) ON DELETE CASCADE,
  payload    JSON NOT NULL, -- canonical JSON of the audit entry's payload
  prev_hash  TEXT NOT NULL, -- 64-hex char hash, 64 zeros for a sandbox's first entry
  hash       TEXT NOT NULL  -- SHA-256 hex of (prev_hash + canonical JSON of the entry)
);

-- The purge flag is a one-row table the no-delete triggers consult.
-- SQLite forbids triggers in the main database from referencing temp
-- tables, so the flag lives here, in the main schema. openDb resets it
-- to 0 on every open, the purge path is the only writer, and it is
-- always reset in a finally block, so a stuck flag cannot survive a
-- restart. Nothing else may set it.

CREATE TABLE IF NOT EXISTS purge_mode (
  id     INTEGER PRIMARY KEY CHECK (id = 1),
  active INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO purge_mode (id, active) VALUES (1, 0);

CREATE TRIGGER IF NOT EXISTS audit_no_update
BEFORE UPDATE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'audit_log is append-only: updates are forbidden');
END;

CREATE TRIGGER IF NOT EXISTS audit_no_delete
BEFORE DELETE ON audit_log
WHEN (SELECT active FROM purge_mode WHERE id = 1) IS NOT 1
BEGIN
  SELECT RAISE(ABORT, 'audit_log is append-only: deletes are forbidden outside a sandbox purge');
END;

-- The chain link is the real integrity property: each new entry's
-- prev_hash must equal the current tail hash of its sandbox, or 64
-- zeros for the first entry. A seq-contiguity trigger is deliberately
-- NOT added: seq is a global AUTOINCREMENT, and purging reuses nothing
-- while sqlite_sequence keeps the high-water mark, so strict global
-- contiguity cannot hold after a purge. The chain link plus strictly
-- increasing seqs (checked by verifyChain) is the enforceable
-- guarantee.
CREATE TRIGGER IF NOT EXISTS audit_chain_link
BEFORE INSERT ON audit_log
WHEN NEW.prev_hash IS NOT COALESCE(
  (SELECT hash FROM audit_log WHERE sandbox_id = NEW.sandbox_id ORDER BY seq DESC LIMIT 1),
  '0000000000000000000000000000000000000000000000000000000000000000'
)
BEGIN
  SELECT RAISE(ABORT, 'audit_log prev_hash does not match the chain tail for this sandbox');
END;

CREATE TRIGGER IF NOT EXISTS decisions_no_update
BEFORE UPDATE ON decisions
BEGIN
  SELECT RAISE(ABORT, 'decisions are immutable once written');
END;

CREATE TRIGGER IF NOT EXISTS decisions_no_delete
BEFORE DELETE ON decisions
WHEN (SELECT active FROM purge_mode WHERE id = 1) IS NOT 1
BEGIN
  SELECT RAISE(ABORT, 'decisions cannot be deleted outside a sandbox purge');
END;

CREATE TRIGGER IF NOT EXISTS payments_no_update
BEFORE UPDATE ON payments
BEGIN
  SELECT RAISE(ABORT, 'payments are immutable once written');
END;

CREATE TRIGGER IF NOT EXISTS payments_no_delete
BEFORE DELETE ON payments
WHEN (SELECT active FROM purge_mode WHERE id = 1) IS NOT 1
BEGIN
  SELECT RAISE(ABORT, 'payments cannot be deleted outside a sandbox purge');
END;

-- No payment without an APPROVED decision for its proposal (R1.7).
CREATE TRIGGER IF NOT EXISTS payments_require_approved
BEFORE INSERT ON payments
WHEN NOT EXISTS (
  SELECT 1 FROM decisions WHERE proposal_id = NEW.proposal_id AND outcome = 'APPROVED'
)
BEGIN
  SELECT RAISE(ABORT, 'payments require an APPROVED decision for the proposal');
END;

-- proposals.status is the only mutable column, and it moves exactly
-- once: RECEIVED -> EXECUTED or BLOCKED. Everything else about a
-- proposal row is frozen at insert time.
CREATE TRIGGER IF NOT EXISTS proposals_status_once
BEFORE UPDATE ON proposals
WHEN OLD.status <> 'RECEIVED'
  OR NEW.status NOT IN ('EXECUTED', 'BLOCKED')
  OR OLD.id <> NEW.id
  OR OLD.sandbox_id <> NEW.sandbox_id
  OR OLD.idempotency_key IS NOT NEW.idempotency_key
  OR OLD.request_hash <> NEW.request_hash
  OR OLD.amount_cents <> NEW.amount_cents
  OR OLD.currency <> NEW.currency
  OR OLD.memo IS NOT NEW.memo
  OR OLD.recipient_key <> NEW.recipient_key
  OR OLD.label IS NOT NEW.label
  OR OLD.created_at <> NEW.created_at
BEGIN
  SELECT RAISE(ABORT, 'proposals may only move once from RECEIVED to EXECUTED or BLOCKED');
END;
