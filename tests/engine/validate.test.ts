import { describe, expect, it } from "vitest";

import { normalizeRecipient, validateProposal } from "../../src/engine/validate.js";

describe("normalizeRecipient", () => {
  it("trims, lowercases, and folds compatibility characters", () => {
    expect(normalizeRecipient("  Acme Corp ")).toEqual({ ok: true, key: "acme corp" });
    expect(normalizeRecipient("ＡＣＭＥ")).toEqual({ ok: true, key: "acme" });
    expect(normalizeRecipient("ACME-CORP")).toEqual({ ok: true, key: "acme-corp" });
  });

  it("rejects empty, whitespace-only, and over-long identifiers", () => {
    expect(normalizeRecipient("")).toMatchObject({ ok: false });
    expect(normalizeRecipient("   ")).toMatchObject({ ok: false, error: expect.stringMatching(/empty/) });
    expect(normalizeRecipient("a".repeat(65))).toMatchObject({ ok: false, error: expect.stringMatching(/64/) });
    expect(normalizeRecipient("a".repeat(64))).toMatchObject({ ok: true });
  });

  it("rejects control characters", () => {
    expect(normalizeRecipient("acme\u0000corp")).toMatchObject({ ok: false, error: expect.stringMatching(/control/) });
    expect(normalizeRecipient("acme\ncorp")).toMatchObject({ ok: false });
  });

  it("does not collapse identifiers that differ after normalization", () => {
    const a = normalizeRecipient("acme-corp");
    const b = normalizeRecipient("acme\u200B-corp");
    expect(a).toMatchObject({ ok: true });
    expect(b).toMatchObject({ ok: true });
    if (a.ok && b.ok) expect(a.key).not.toBe(b.key);
  });
});

describe("validateProposal", () => {
  const good = { recipient: "Acme Corp", amountCents: 10000, currency: "USD", memo: "Hosting" };

  it("accepts a valid proposal and normalizes the recipient", () => {
    expect(validateProposal(good)).toEqual({
      ok: true,
      proposal: { recipientKey: "acme corp", amountCents: 10000, currency: "USD", memo: "Hosting" },
      idempotencyKey: undefined,
    });
  });

  it("trims the memo and keeps an idempotency key", () => {
    const result = validateProposal({ ...good, memo: "  Hosting  ", idempotencyKey: "key-1" });
    expect(result).toMatchObject({ ok: true, idempotencyKey: "key-1" });
    if (result.ok) expect(result.proposal.memo).toBe("Hosting");
  });

  it("rejects non-object input", () => {
    expect(validateProposal(null)).toMatchObject({ ok: false, fields: [{ field: "proposal" }] });
    expect(validateProposal([good])).toMatchObject({ ok: false });
    expect(validateProposal("pay")).toMatchObject({ ok: false });
  });

  it("rejects amount 0, negatives, floats, strings, and over-ceiling values", () => {
    for (const amount of [0, -1, 19.99, "10000", Number.NaN, 1000000001]) {
      const result = validateProposal({ ...good, amountCents: amount });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.fields.some((f) => f.field === "amountCents")).toBe(true);
    }
    expect(validateProposal({ ...good, amountCents: 1000000000 }).ok).toBe(true);
  });

  it("rejects non-USD currency", () => {
    expect(validateProposal({ ...good, currency: "EUR" })).toMatchObject({ ok: false });
    expect(validateProposal({ ...good, currency: "usd" })).toMatchObject({ ok: false });
    expect(validateProposal({ ...good, currency: 840 })).toMatchObject({ ok: false });
  });

  it("rejects memos over 280 characters and non-string memos", () => {
    expect(validateProposal({ ...good, memo: "x".repeat(281) })).toMatchObject({ ok: false });
    expect(validateProposal({ ...good, memo: "x".repeat(280) }).ok).toBe(true);
    expect(validateProposal({ ...good, memo: 42 })).toMatchObject({ ok: false });
  });

  it("rejects empty, control-char, whitespace-only, and over-long recipients", () => {
    expect(validateProposal({ ...good, recipient: "" })).toMatchObject({ ok: false });
    expect(validateProposal({ ...good, recipient: "   " })).toMatchObject({ ok: false });
    expect(validateProposal({ ...good, recipient: "a\u0007b" })).toMatchObject({ ok: false });
    expect(validateProposal({ ...good, recipient: "r".repeat(65) })).toMatchObject({ ok: false });
    expect(validateProposal({ ...good, recipient: 7 })).toMatchObject({ ok: false });
  });

  it("collects every field error instead of stopping at the first", () => {
    const result = validateProposal({ recipient: "", amountCents: 0, currency: "EUR", memo: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fields.map((f) => f.field).sort()).toEqual([
        "amountCents",
        "currency",
        "memo",
        "recipient",
      ]);
    }
  });

  it("rejects malformed idempotency keys", () => {
    expect(validateProposal({ ...good, idempotencyKey: "" })).toMatchObject({ ok: false });
    expect(validateProposal({ ...good, idempotencyKey: 42 })).toMatchObject({ ok: false });
    expect(validateProposal({ ...good, idempotencyKey: "k".repeat(129) })).toMatchObject({ ok: false });
  });

  it("ignores unknown extra fields", () => {
    const result = validateProposal({ ...good, approved: true, bypass: true });
    expect(result.ok).toBe(true);
  });
});
