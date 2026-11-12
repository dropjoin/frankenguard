import { describe, expect, it } from "vitest";

import { createRepositories } from "../../src/db/repositories.js";
import { openTestDb } from "./helpers.js";

function seedSandbox(db: ReturnType<typeof openTestDb>, id: string): void {
  db.prepare(
    "INSERT INTO sandboxes (id, created_at, last_seen_at, expires_at, state) VALUES (?, 't', 't', 't', 'ACTIVE')",
  ).run(id);
}

describe("repositories", () => {
  it("round-trips config and bumps the version on caps/freeze updates", () => {
    const db = openTestDb();
    seedSandbox(db, "sb-1");
    const repos = createRepositories(db);
    repos.config.insert({
      sandbox_id: "sb-1",
      config_version: 1,
      per_tx_cap_cents: 50000,
      daily_cap_cents: 100000,
      frozen: 0,
      updated_at: "t",
    });
    repos.config.updateCaps("sb-1", 60000, 120000, "t2");
    expect(repos.config.getBySandbox("sb-1")).toMatchObject({
      config_version: 2,
      per_tx_cap_cents: 60000,
      daily_cap_cents: 120000,
    });
    repos.config.updateFrozen("sb-1", 1, "t3");
    expect(repos.config.getBySandbox("sb-1")).toMatchObject({ config_version: 3, frozen: 1 });
  });

  it("lists the allowlist sorted by key and counts entries", () => {
    const db = openTestDb();
    seedSandbox(db, "sb-1");
    const repos = createRepositories(db);
    repos.allowlist.insert({ sandbox_id: "sb-1", recipient_key: "zeta", label: "Zeta", created_at: "t" });
    repos.allowlist.insert({ sandbox_id: "sb-1", recipient_key: "alpha", label: "Alpha", created_at: "t" });
    expect(repos.allowlist.listBySandbox("sb-1").map((r) => r.recipient_key)).toEqual(["alpha", "zeta"]);
    expect(repos.allowlist.countBySandbox("sb-1")).toBe(2);
    expect(repos.allowlist.remove("sb-1", "alpha")).toBe(true);
    expect(repos.allowlist.remove("sb-1", "alpha")).toBe(false);
    expect(repos.allowlist.countBySandbox("sb-1")).toBe(1);
  });

  it("finds proposals by idempotency key within a sandbox only", () => {
    const db = openTestDb();
    seedSandbox(db, "sb-1");
    seedSandbox(db, "sb-2");
    const repos = createRepositories(db);
    const base = {
      request_hash: "h",
      amount_cents: 100,
      currency: "USD",
      memo: null,
      recipient_key: "a",
      label: null,
      status: "RECEIVED" as const,
      created_at: "t",
    };
    repos.proposals.insert({ ...base, id: "p1", sandbox_id: "sb-1", idempotency_key: "k1" });
    expect(repos.proposals.getByIdempotencyKey("sb-1", "k1")?.id).toBe("p1");
    expect(repos.proposals.getByIdempotencyKey("sb-2", "k1")).toBeUndefined();
  });

  it("sums payments in [start, end) and isolates sandboxes", () => {
    const db = openTestDb();
    seedSandbox(db, "sb-1");
    seedSandbox(db, "sb-2");
    const repos = createRepositories(db);
    const mkPayment = (id: string, sandbox: string, proposal: string, amount: number, executedAt: string) => {
      db.prepare(
        "INSERT INTO proposals (id, sandbox_id, request_hash, amount_cents, currency, recipient_key, created_at) VALUES (?, ?, 'h', ?, 'USD', 'a', 't')",
      ).run(proposal, sandbox, amount);
      db.prepare(
        "INSERT INTO decisions (proposal_id, outcome, reasons_json, snapshot_json, created_at) VALUES (?, 'APPROVED', '[]', '{}', 't')",
      ).run(proposal);
      repos.payments.insert({
        id,
        sandbox_id: sandbox,
        proposal_id: proposal,
        decision_id: proposal,
        amount_cents: amount,
        recipient_key: "a",
        created_at: executedAt,
        executed_at: executedAt,
      });
    };
    mkPayment("pay-1", "sb-1", "prop-1", 1000, "2026-11-13T00:00:00.000Z"); // window start: included
    mkPayment("pay-2", "sb-1", "prop-2", 2000, "2026-11-13T23:59:59.999Z"); // inside: included
    mkPayment("pay-3", "sb-1", "prop-3", 4000, "2026-11-14T00:00:00.000Z"); // window end: excluded
    mkPayment("pay-4", "sb-1", "prop-4", 8000, "2026-11-12T23:59:59.999Z"); // before start: excluded
    mkPayment("pay-5", "sb-2", "prop-5", 16000, "2026-11-13T12:00:00.000Z"); // other sandbox: excluded
    expect(repos.payments.sumForWindow("sb-1", "2026-11-13T00:00:00.000Z", "2026-11-14T00:00:00.000Z")).toBe(3000);
    expect(repos.payments.sumForWindow("sb-2", "2026-11-13T00:00:00.000Z", "2026-11-14T00:00:00.000Z")).toBe(16000);
    expect(repos.payments.sumForWindow("sb-1", "2026-11-14T00:00:00.000Z", "2026-11-15T00:00:00.000Z")).toBe(4000);
  });

  it("counts and totals payments per sandbox", () => {
    const db = openTestDb();
    seedSandbox(db, "sb-1");
    const repos = createRepositories(db);
    expect(repos.payments.countBySandbox("sb-1")).toBe(0);
    expect(repos.payments.totalBySandbox("sb-1")).toBe(0);
  });
});
