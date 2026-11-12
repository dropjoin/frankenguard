import { describe, expect, it } from "vitest";

import { withImmediateTransaction, withPurgeMode } from "../../src/db/migrate.js";
import { appendAudit, GENESIS_PREV_HASH } from "../../src/services/audit/chain.js";
import { openTestDb } from "./helpers.js";

const ZERO = GENESIS_PREV_HASH;

function seedSandbox(db: ReturnType<typeof openTestDb>, id = "sb-1"): void {
  db.prepare(
    "INSERT OR IGNORE INTO sandboxes (id, created_at, last_seen_at, expires_at, state) VALUES (?, '2026-11-13T00:00:00.000Z', '2026-11-13T00:00:00.000Z', '2026-11-13T01:00:00.000Z', 'ACTIVE')",
  ).run(id);
}

function seedProposal(db: ReturnType<typeof openTestDb>, id = "prop-1"): void {
  seedSandbox(db);
  db.prepare(
    `INSERT INTO proposals (id, sandbox_id, request_hash, amount_cents, currency, recipient_key, status, created_at)
     VALUES (?, 'sb-1', 'hash', 1000, 'USD', 'acme-corp', 'RECEIVED', '2026-11-13T00:00:00.000Z')`,
  ).run(id);
}

describe("audit triggers", () => {
  it("rejects updates to audit rows", () => {
    const db = openTestDb();
    seedSandbox(db);
    const { seq } = appendAudit(db, "sb-1", {
      type: "SANDBOX_CREATED",
      ts: "2026-11-13T00:00:00.000Z",
      actor: "system",
      proposalId: null,
      payload: {},
    });
    expect(() => db.prepare("UPDATE audit_log SET type = 'X' WHERE seq = ?").run(seq)).toThrow(/append-only/);
  });

  it("rejects deletes outside a purge, and allows them inside one", () => {
    const db = openTestDb();
    seedSandbox(db);
    const { seq } = appendAudit(db, "sb-1", {
      type: "SANDBOX_CREATED",
      ts: "2026-11-13T00:00:00.000Z",
      actor: "system",
      proposalId: null,
      payload: {},
    });
    expect(() => db.prepare("DELETE FROM audit_log WHERE seq = ?").run(seq)).toThrow(/append-only/);
    withImmediateTransaction(db, () => {
      withPurgeMode(db, () => {
        db.prepare("DELETE FROM audit_log WHERE seq = ?").run(seq);
      });
    });
    expect(db.prepare("SELECT COUNT(*) AS n FROM audit_log").get()).toEqual({ n: 0 });
  });

  it("rejects an insert whose prev_hash does not match the chain tail", () => {
    const db = openTestDb();
    seedSandbox(db);
    appendAudit(db, "sb-1", {
      type: "SANDBOX_CREATED",
      ts: "2026-11-13T00:00:00.000Z",
      actor: "system",
      proposalId: null,
      payload: {},
    });
    expect(() =>
      db
        .prepare(
          "INSERT INTO audit_log (sandbox_id, type, ts, actor, payload, prev_hash, hash) VALUES ('sb-1', 'X', 't', 'system', '{}', ?, 'abc')",
        )
        .run(ZERO),
    ).toThrow(/prev_hash/);
  });

  it("lets a different sandbox start its own chain from the genesis hash", () => {
    const db = openTestDb();
    seedSandbox(db, "sb-1");
    seedSandbox(db, "sb-2");
    const first = appendAudit(db, "sb-1", {
      type: "SANDBOX_CREATED",
      ts: "2026-11-13T00:00:00.000Z",
      actor: "system",
      proposalId: null,
      payload: {},
    });
    const second = appendAudit(db, "sb-2", {
      type: "SANDBOX_CREATED",
      ts: "2026-11-13T00:00:00.000Z",
      actor: "system",
      proposalId: null,
      payload: {},
    });
    expect(first.hash).not.toBe(second.hash); // seq differs, so the hash differs
    const rows = db.prepare("SELECT sandbox_id, prev_hash FROM audit_log ORDER BY seq").all() as {
      sandbox_id: string;
      prev_hash: string;
    }[];
    expect(rows).toEqual([
      { sandbox_id: "sb-1", prev_hash: ZERO },
      { sandbox_id: "sb-2", prev_hash: ZERO },
    ]);
  });
});

describe("decisions and payments triggers", () => {
  it("rejects updates and deletes of decisions outside a purge", () => {
    const db = openTestDb();
    seedProposal(db);
    db.prepare(
      "INSERT INTO decisions (proposal_id, outcome, reasons_json, snapshot_json, created_at) VALUES ('prop-1', 'APPROVED', '[]', '{}', 't')",
    ).run();
    expect(() => db.prepare("UPDATE decisions SET outcome = 'REJECTED' WHERE proposal_id = 'prop-1'").run()).toThrow(
      /immutable/,
    );
    expect(() => db.prepare("DELETE FROM decisions WHERE proposal_id = 'prop-1'").run()).toThrow(/purge/);
  });

  it("rejects a payment without an APPROVED decision", () => {
    const db = openTestDb();
    seedProposal(db);
    expect(() =>
      db
        .prepare(
          "INSERT INTO payments (id, sandbox_id, proposal_id, decision_id, amount_cents, recipient_key, created_at, executed_at) VALUES ('pay-1', 'sb-1', 'prop-1', 'prop-1', 1000, 'acme-corp', 't', 't')",
        )
        .run(),
    ).toThrow(/APPROVED/);
  });

  it("rejects a payment against a REJECTED decision, and allows one against APPROVED", () => {
    const db = openTestDb();
    seedProposal(db, "prop-1");
    seedProposal(db, "prop-2");
    db.prepare(
      "INSERT INTO decisions (proposal_id, outcome, reasons_json, snapshot_json, created_at) VALUES ('prop-1', 'REJECTED', '[]', '{}', 't')",
    ).run();
    db.prepare(
      "INSERT INTO decisions (proposal_id, outcome, reasons_json, snapshot_json, created_at) VALUES ('prop-2', 'APPROVED', '[]', '{}', 't')",
    ).run();
    expect(() =>
      db
        .prepare(
          "INSERT INTO payments (id, sandbox_id, proposal_id, decision_id, amount_cents, recipient_key, created_at, executed_at) VALUES ('pay-1', 'sb-1', 'prop-1', 'prop-1', 1000, 'acme-corp', 't', 't')",
        )
        .run(),
    ).toThrow(/APPROVED/);
    db.prepare(
      "INSERT INTO payments (id, sandbox_id, proposal_id, decision_id, amount_cents, recipient_key, created_at, executed_at) VALUES ('pay-2', 'sb-1', 'prop-2', 'prop-2', 1000, 'acme-corp', 't', 't')",
    ).run();
    expect(db.prepare("SELECT COUNT(*) AS n FROM payments").get()).toEqual({ n: 1 });
  });

  it("rejects updates to payments", () => {
    const db = openTestDb();
    seedProposal(db);
    db.prepare(
      "INSERT INTO decisions (proposal_id, outcome, reasons_json, snapshot_json, created_at) VALUES ('prop-1', 'APPROVED', '[]', '{}', 't')",
    ).run();
    db.prepare(
      "INSERT INTO payments (id, sandbox_id, proposal_id, decision_id, amount_cents, recipient_key, created_at, executed_at) VALUES ('pay-1', 'sb-1', 'prop-1', 'prop-1', 1000, 'acme-corp', 't', 't')",
    ).run();
    expect(() => db.prepare("UPDATE payments SET amount_cents = 1 WHERE id = 'pay-1'").run()).toThrow(/immutable/);
  });
});

describe("proposals status trigger", () => {
  it("allows the single RECEIVED -> EXECUTED transition and no other", () => {
    const db = openTestDb();
    seedProposal(db);
    db.prepare("UPDATE proposals SET status = 'EXECUTED' WHERE id = 'prop-1'").run();
    expect(db.prepare("SELECT status FROM proposals WHERE id = 'prop-1'").get()).toEqual({ status: "EXECUTED" });
    expect(() => db.prepare("UPDATE proposals SET status = 'BLOCKED' WHERE id = 'prop-1'").run()).toThrow(
      /RECEIVED/,
    );
    expect(() => db.prepare("UPDATE proposals SET status = 'RECEIVED' WHERE id = 'prop-1'").run()).toThrow(
      /RECEIVED/,
    );
  });

  it("rejects changes to any column other than status", () => {
    const db = openTestDb();
    seedProposal(db);
    expect(() => db.prepare("UPDATE proposals SET amount_cents = 2 WHERE id = 'prop-1'").run()).toThrow(/RECEIVED/);
    expect(() => db.prepare("UPDATE proposals SET status = 'BLOCKED', amount_cents = 2 WHERE id = 'prop-1'").run()).toThrow(
      /RECEIVED/,
    );
  });

  it("allows RECEIVED -> BLOCKED", () => {
    const db = openTestDb();
    seedProposal(db);
    db.prepare("UPDATE proposals SET status = 'BLOCKED' WHERE id = 'prop-1'").run();
    expect(db.prepare("SELECT status FROM proposals WHERE id = 'prop-1'").get()).toEqual({ status: "BLOCKED" });
  });
});

describe("idempotency index", () => {
  it("rejects a second proposal with the same sandbox + key", () => {
    const db = openTestDb();
    seedSandbox(db);
    const insert = db.prepare(
      "INSERT INTO proposals (id, sandbox_id, idempotency_key, request_hash, amount_cents, currency, recipient_key, created_at) VALUES (?, 'sb-1', 'k1', 'h', 1, 'USD', 'a', 't')",
    );
    insert.run("p1");
    expect(() => insert.run("p2")).toThrow(/UNIQUE/);
  });

  it("allows null keys and the same key in another sandbox", () => {
    const db = openTestDb();
    seedSandbox(db, "sb-1");
    seedSandbox(db, "sb-2");
    const insert = db.prepare(
      "INSERT INTO proposals (id, sandbox_id, idempotency_key, request_hash, amount_cents, currency, recipient_key, created_at) VALUES (?, ?, ?, 'h', 1, 'USD', 'a', 't')",
    );
    insert.run("p1", "sb-1", null);
    insert.run("p2", "sb-1", null);
    insert.run("p3", "sb-1", "k1");
    insert.run("p4", "sb-2", "k1");
    expect(db.prepare("SELECT COUNT(*) AS n FROM proposals").get()).toEqual({ n: 4 });
  });
});
