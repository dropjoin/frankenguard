import { describe, expect, it } from "vitest";

import { getProposalBundle, listAudit } from "../../src/services/audit/queries.js";
import { submitProposal } from "../../src/services/proposals.js";
import { createSandbox } from "../../src/services/sandbox.js";
import { setFrozen } from "../../src/services/config.js";
import { NotFoundError } from "../../src/shared/errors.js";
import { makeTestDb } from "../helpers.js";

function seed(db: ReturnType<typeof makeTestDb>["db"], clock: ReturnType<typeof makeTestDb>["clock"], sandboxId: string) {
  const approved = submitProposal(db, clock, sandboxId, { recipient: "acme-corp", amountCents: 10_000, currency: "USD", memo: "ok" }, "agent:scripted");
  const overCap = submitProposal(db, clock, sandboxId, { recipient: "acme-corp", amountCents: 75_000, currency: "USD", memo: "big" }, "agent:scripted");
  const unknown = submitProposal(db, clock, sandboxId, { recipient: "evil.com (real)", amountCents: 5_000, currency: "USD", memo: "" }, "agent:scripted");
  const invalid = submitProposal(db, clock, sandboxId, { recipient: "acme-corp", amountCents: 0, currency: "USD", memo: "" }, "agent:scripted");
  setFrozen(db, clock, sandboxId, { frozen: true }, "operator");
  return { approved, overCap, unknown, invalid };
}

describe("listAudit", () => {
  it("pages by cursor, oldest first, with a next cursor only when more rows exist", () => {
    const { db, clock, sandbox } = makeTestDb();
    seed(db, clock, sandbox.id);
    const first = listAudit(db, sandbox.id, { limit: 3 });
    expect(first.entries).toHaveLength(3);
    expect(first.entries.map((e) => e.type)).toEqual(["SANDBOX_CREATED", "PROPOSAL_RECEIVED", "DECISION_MADE"]);
    expect(first.nextAfterSeq).toBe(first.entries[2]!.seq);
    const second = listAudit(db, sandbox.id, { limit: 3, afterSeq: first.nextAfterSeq! });
    expect(second.entries).toHaveLength(3);
    expect(second.entries[0]!.seq).toBeGreaterThan(first.entries[2]!.seq);
    const rest = listAudit(db, sandbox.id, { limit: 100, afterSeq: second.nextAfterSeq ?? undefined });
    expect(rest.nextAfterSeq).toBeNull();
  });

  it("filters by outcome", () => {
    const { db, clock, sandbox } = makeTestDb();
    seed(db, clock, sandbox.id);
    const approved = listAudit(db, sandbox.id, { outcome: "APPROVED" });
    expect(approved.entries).toHaveLength(1);
    expect(approved.entries[0]!.type).toBe("DECISION_MADE");
    const rejected = listAudit(db, sandbox.id, { outcome: "REJECTED" });
    // Two DECISION_MADE rejections plus the invalid proposal's PROPOSAL_RECEIVED row.
    expect(rejected.entries).toHaveLength(3);
  });

  it("filters by reason code, matching payload.reason and codes inside payload.reasons", () => {
    const { db, clock, sandbox } = makeTestDb();
    seed(db, clock, sandbox.id);
    const perTx = listAudit(db, sandbox.id, { code: "PER_TX_CAP_EXCEEDED" });
    expect(perTx.entries).toHaveLength(1);
    const allowlist = listAudit(db, sandbox.id, { code: "RECIPIENT_NOT_ALLOWED" });
    expect(allowlist.entries).toHaveLength(1);
    const invalid = listAudit(db, sandbox.id, { code: "INVALID_PROPOSAL" });
    expect(invalid.entries).toHaveLength(1);
    expect(invalid.entries[0]!.type).toBe("PROPOSAL_RECEIVED");
    const frozen = listAudit(db, sandbox.id, { code: "SYSTEM_FROZEN" });
    expect(frozen.entries).toHaveLength(0);
  });

  it("filters by recipient, matching linked proposals and payload keys", () => {
    const { db, clock, sandbox } = makeTestDb();
    seed(db, clock, sandbox.id);
    const acme = listAudit(db, sandbox.id, { recipient: "ACME-CORP" });
    // acme: approved (3 entries) + over-cap (2) + invalid (1) = 6. SANDBOX_CREATED and FREEZE_CHANGED are not linked.
    expect(acme.entries).toHaveLength(6);
    const evil = listAudit(db, sandbox.id, { recipient: "evil.com (real)" });
    expect(evil.entries).toHaveLength(2);
    const none = listAudit(db, sandbox.id, { recipient: "   " });
    expect(none.entries).toHaveLength(0);
  });

  it("combines filters", () => {
    const { db, clock, sandbox } = makeTestDb();
    seed(db, clock, sandbox.id);
    const rows = listAudit(db, sandbox.id, { recipient: "acme-corp", outcome: "REJECTED" });
    expect(rows.entries).toHaveLength(2); // over-cap decision + invalid received
  });
});

describe("getProposalBundle", () => {
  it("returns the proposal, decision, payment, and linked audit entries for an approved proposal", () => {
    const { db, clock, sandbox } = makeTestDb();
    const { approved } = seed(db, clock, sandbox.id);
    const bundle = getProposalBundle(db, sandbox.id, approved.proposalId);
    expect(bundle.proposal.amountCents).toBe(10_000);
    expect(bundle.proposal.recipientKey).toBe("acme-corp");
    expect(bundle.proposal.status).toBe("EXECUTED");
    expect(bundle.decision?.outcome).toBe("APPROVED");
    expect(bundle.decision?.reasons).toHaveLength(4);
    expect(bundle.decision?.snapshot).not.toBeNull();
    expect(bundle.payment?.amountCents).toBe(10_000);
    expect(bundle.auditEntries.map((e) => e.type)).toEqual(["PROPOSAL_RECEIVED", "DECISION_MADE", "PAYMENT_EXECUTED"]);
  });

  it("returns a null decision and payment for an invalid proposal", () => {
    const { db, clock, sandbox } = makeTestDb();
    const { invalid } = seed(db, clock, sandbox.id);
    const bundle = getProposalBundle(db, sandbox.id, invalid.proposalId);
    expect(bundle.decision).toBeNull();
    expect(bundle.payment).toBeNull();
    expect(bundle.auditEntries).toHaveLength(1);
  });

  it("returns 404 for an unknown proposal or a proposal from another sandbox", () => {
    const { db, clock, sandbox } = makeTestDb();
    const { approved } = seed(db, clock, sandbox.id);
    expect(() => getProposalBundle(db, sandbox.id, "nope")).toThrow(NotFoundError);
    const other = createSandbox(db, clock);
    expect(() => getProposalBundle(db, other.id, approved.proposalId)).toThrow(NotFoundError);
  });
});
