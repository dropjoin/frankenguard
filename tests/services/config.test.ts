import { describe, expect, it } from "vitest";

import { createRepositories } from "../../src/db/repositories.js";
import { verifyChain } from "../../src/services/audit/chain.js";
import {
  addRecipient,
  getCaps,
  removeRecipient,
  setFrozen,
  updateCaps,
} from "../../src/services/config.js";
import {
  DuplicateRecipientError,
  InvalidInputError,
  NotFoundError,
  SandboxLimitReachedError,
} from "../../src/shared/errors.js";
import { makeTestDb } from "../helpers.js";

describe("updateCaps", () => {
  it("updates caps, bumps the version, and writes a CAPS_CHANGED entry", () => {
    const { db, clock, sandbox } = makeTestDb();
    const res = updateCaps(db, clock, sandbox.id, { perTxCapCents: 25_000, dailyCapCents: 60_000 }, "operator");
    expect(res).toEqual({ configVersion: 2, perTxCapCents: 25_000, dailyCapCents: 60_000 });
    expect(getCaps(db, sandbox.id)).toEqual({ configVersion: 2, perTxCapCents: 25_000, dailyCapCents: 60_000, frozen: false });
    const entries = createRepositories(db).audit.listBySandbox(sandbox.id);
    const change = entries.find((e) => e.type === "CAPS_CHANGED");
    expect(change).toBeDefined();
    const payload = JSON.parse(change!.payload) as { previous: unknown; new: unknown; configVersion: number };
    expect(payload.previous).toEqual({ perTxCapCents: 50_000, dailyCapCents: 100_000 });
    expect(payload.new).toEqual({ perTxCapCents: 25_000, dailyCapCents: 60_000 });
    expect(payload.configVersion).toBe(2);
    expect(verifyChain(db, sandbox.id).ok).toBe(true);
  });

  it("rejects per-tx above daily, zero, and non-integer caps without writing anything", () => {
    const { db, clock, sandbox } = makeTestDb();
    for (const bad of [
      { perTxCapCents: 200_000, dailyCapCents: 100_000 },
      { perTxCapCents: 0, dailyCapCents: 100_000 },
      { perTxCapCents: 10.5, dailyCapCents: 100_000 },
      { perTxCapCents: 50_000, dailyCapCents: 2_000_000_000 },
    ]) {
      expect(() => updateCaps(db, clock, sandbox.id, bad, "operator")).toThrow(InvalidInputError);
    }
    expect(getCaps(db, sandbox.id).configVersion).toBe(1);
    expect(createRepositories(db).audit.countBySandbox(sandbox.id)).toBe(1);
  });
});

describe("allowlist", () => {
  it("adds a recipient with normalization and an ALLOWLIST_CHANGED entry", () => {
    const { db, clock, sandbox } = makeTestDb();
    const res = addRecipient(db, clock, sandbox.id, { recipient: "  Umbrella Corp ", label: "Umbrella" }, "operator");
    expect(res).toEqual({ recipientKey: "umbrella corp", label: "Umbrella" });
    const rows = createRepositories(db).allowlist.listBySandbox(sandbox.id);
    expect(rows.map((r) => r.recipient_key)).toContain("umbrella corp");
    const entries = createRepositories(db).audit.listBySandbox(sandbox.id);
    expect(entries.some((e) => e.type === "ALLOWLIST_CHANGED")).toBe(true);
  });

  it("defaults the label to the recipient as typed", () => {
    const { db, clock, sandbox } = makeTestDb();
    const res = addRecipient(db, clock, sandbox.id, { recipient: "Wayne Enterprises" }, "operator");
    expect(res.label).toBe("Wayne Enterprises");
  });

  it("returns 409 for a duplicate after normalization", () => {
    const { db, clock, sandbox } = makeTestDb();
    expect(() => addRecipient(db, clock, sandbox.id, { recipient: "ACME-CORP" }, "operator")).toThrow(
      DuplicateRecipientError,
    );
    expect(createRepositories(db).allowlist.countBySandbox(sandbox.id)).toBe(3);
  });

  it("removes a recipient and audits the removal", () => {
    const { db, clock, sandbox } = makeTestDb();
    const res = removeRecipient(db, clock, sandbox.id, { recipient: "Globex-Corp" }, "operator");
    expect(res.recipientKey).toBe("globex-corp");
    expect(createRepositories(db).allowlist.listBySandbox(sandbox.id)).toHaveLength(2);
    const entries = createRepositories(db).audit.listBySandbox(sandbox.id);
    const change = entries.find((e) => e.type === "ALLOWLIST_CHANGED");
    const payload = JSON.parse(change!.payload) as { change: string; recipientKey: string };
    expect(payload.change).toBe("removed");
    expect(payload.recipientKey).toBe("globex-corp");
  });

  it("returns 404 when removing a recipient that is not listed", () => {
    const { db, clock, sandbox } = makeTestDb();
    expect(() => removeRecipient(db, clock, sandbox.id, { recipient: "nobody" }, "operator")).toThrow(NotFoundError);
  });

  it("rejects an empty recipient without writing anything", () => {
    const { db, clock, sandbox } = makeTestDb();
    expect(() => addRecipient(db, clock, sandbox.id, { recipient: "   " }, "operator")).toThrow(InvalidInputError);
    expect(createRepositories(db).audit.countBySandbox(sandbox.id)).toBe(1);
  });

  it("enforces the 50-entry allowlist limit", () => {
    const { db, clock, sandbox } = makeTestDb();
    for (let i = 0; i < 47; i++) {
      addRecipient(db, clock, sandbox.id, { recipient: `vendor-${i}` }, "operator");
    }
    expect(createRepositories(db).allowlist.countBySandbox(sandbox.id)).toBe(50);
    expect(() => addRecipient(db, clock, sandbox.id, { recipient: "one-too-many" }, "operator")).toThrow(
      SandboxLimitReachedError,
    );
  });
});

describe("setFrozen", () => {
  it("freezes and unfreezes, bumping the version and auditing both", () => {
    const { db, clock, sandbox } = makeTestDb();
    const frozen = setFrozen(db, clock, sandbox.id, { frozen: true, note: "suspicious activity" }, "operator");
    expect(frozen).toEqual({ configVersion: 2, frozen: true });
    const thawed = setFrozen(db, clock, sandbox.id, { frozen: false }, "operator");
    expect(thawed).toEqual({ configVersion: 3, frozen: false });
    const entries = createRepositories(db).audit.listBySandbox(sandbox.id);
    const changes = entries.filter((e) => e.type === "FREEZE_CHANGED");
    expect(changes).toHaveLength(2);
    const first = JSON.parse(changes[0]!.payload) as { previous: boolean; new: boolean; note: string | null };
    expect(first).toEqual({ previous: false, new: true, note: "suspicious activity", configVersion: 2 });
  });

  it("rejects a non-boolean frozen value", () => {
    const { db, clock, sandbox } = makeTestDb();
    expect(() => setFrozen(db, clock, sandbox.id, { frozen: "yes" }, "operator")).toThrow(InvalidInputError);
    expect(getCaps(db, sandbox.id).frozen).toBe(false);
  });
});
