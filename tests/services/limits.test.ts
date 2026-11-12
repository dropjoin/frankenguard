import { describe, expect, it } from "vitest";

import { createRepositories } from "../../src/db/repositories.js";
import { appendAudit } from "../../src/services/audit/chain.js";
import { submitProposal } from "../../src/services/proposals.js";
import { SandboxLimitReachedError } from "../../src/shared/errors.js";
import { makeTestDb } from "../helpers.js";

// The per-sandbox limits (R7.17): 500 proposals, 2,000 audit entries.
// The allowlist limit (50) is covered in config.test.ts. These tests
// seed rows directly to reach the boundary without 500 submits.

describe("sandbox limits", () => {
  it("refuses a new proposal once 500 proposals exist, with no partial write", () => {
    const { db, clock, sandbox } = makeTestDb();
    const repos = createRepositories(db);
    for (let i = 0; i < 500; i++) {
      repos.proposals.insert({
        id: `seed-${i}`,
        sandbox_id: sandbox.id,
        idempotency_key: null,
        request_hash: `hash-${i}`,
        amount_cents: 100,
        currency: "USD",
        memo: null,
        recipient_key: "acme-corp",
        label: null,
        status: "BLOCKED",
        created_at: clock.nowIso(),
      });
    }
    expect(() =>
      submitProposal(db, clock, sandbox.id, { recipient: "acme-corp", amountCents: 100, currency: "USD", memo: "" }, "agent:scripted"),
    ).toThrow(SandboxLimitReachedError);
    expect(repos.proposals.countBySandbox(sandbox.id)).toBe(500);
    expect(repos.audit.countBySandbox(sandbox.id)).toBe(1);
  });

  it("refuses a submit that would push the audit log past 2,000 entries", () => {
    const { db, clock, sandbox } = makeTestDb();
    // SANDBOX_CREATED is entry 1; pad to 1,999, so a 3-entry submit would land at 2,002.
    for (let i = 0; i < 1998; i++) {
      appendAudit(db, sandbox.id, {
        type: "AUDIT_VERIFIED",
        ts: clock.nowIso(),
        actor: "system",
        proposalId: null,
        payload: { ok: true },
      });
    }
    expect(createRepositories(db).audit.countBySandbox(sandbox.id)).toBe(1999);
    expect(() =>
      submitProposal(db, clock, sandbox.id, { recipient: "acme-corp", amountCents: 100, currency: "USD", memo: "" }, "agent:scripted"),
    ).toThrow(SandboxLimitReachedError);
    expect(createRepositories(db).audit.countBySandbox(sandbox.id)).toBe(1999);
  });

  it("accepts a submit when the audit log has exactly enough room", () => {
    const { db, clock, sandbox } = makeTestDb();
    for (let i = 0; i < 1996; i++) {
      appendAudit(db, sandbox.id, {
        type: "AUDIT_VERIFIED",
        ts: clock.nowIso(),
        actor: "system",
        proposalId: null,
        payload: { ok: true },
      });
    }
    // 1,997 entries + 3 from an approved submit = exactly 2,000.
    const res = submitProposal(db, clock, sandbox.id, { recipient: "acme-corp", amountCents: 100, currency: "USD", memo: "" }, "agent:scripted");
    expect(res.outcome).toBe("APPROVED");
    expect(createRepositories(db).audit.countBySandbox(sandbox.id)).toBe(2000);
  });
});
