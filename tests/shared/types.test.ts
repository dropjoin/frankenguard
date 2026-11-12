import { describe, expect, it } from "vitest";

import {
  agentRunSchema,
  allowlistAddSchema,
  auditQuerySchema,
  capsSchema,
  freezeSchema,
  proposalInputSchema,
} from "../../src/shared/types.js";

describe("proposalInputSchema", () => {
  it("accepts a well-shaped proposal and strips unknown fields", () => {
    const parsed = proposalInputSchema.parse({
      recipient: "acme-corp",
      amountCents: 10000,
      currency: "USD",
      memo: "Hosting",
      approved: true,
      bypass: true,
    });
    expect(parsed).toEqual({
      recipient: "acme-corp",
      amountCents: 10000,
      currency: "USD",
      memo: "Hosting",
    });
  });

  it("rejects wrong JSON types at the boundary", () => {
    expect(() => proposalInputSchema.parse({ recipient: "x", amountCents: "100", currency: "USD", memo: "" })).toThrow();
    expect(() => proposalInputSchema.parse({ recipient: "x", amountCents: 100 })).toThrow();
  });
});

describe("capsSchema", () => {
  it("accepts valid caps with per-tx equal to daily", () => {
    expect(capsSchema.parse({ perTxCapCents: 50000, dailyCapCents: 50000 })).toEqual({
      perTxCapCents: 50000,
      dailyCapCents: 50000,
    });
  });

  it("rejects per-tx above daily, zero, negative, fractional, and over-ceiling values", () => {
    expect(() => capsSchema.parse({ perTxCapCents: 60000, dailyCapCents: 50000 })).toThrow(
      /must not exceed/,
    );
    expect(() => capsSchema.parse({ perTxCapCents: 0, dailyCapCents: 50000 })).toThrow();
    expect(() => capsSchema.parse({ perTxCapCents: -1, dailyCapCents: 50000 })).toThrow();
    expect(() => capsSchema.parse({ perTxCapCents: 1.5, dailyCapCents: 50000 })).toThrow();
    expect(() => capsSchema.parse({ perTxCapCents: 50000, dailyCapCents: 1000000001 })).toThrow();
  });
});

describe("freezeSchema", () => {
  it("accepts a toggle with or without a note, and rejects long notes", () => {
    expect(freezeSchema.parse({ frozen: true })).toEqual({ frozen: true });
    expect(freezeSchema.parse({ frozen: false, note: "drill" })).toEqual({ frozen: false, note: "drill" });
    expect(() => freezeSchema.parse({ frozen: "yes" })).toThrow();
    expect(() => freezeSchema.parse({ frozen: true, note: "x".repeat(281) })).toThrow();
  });
});

describe("allowlistAddSchema", () => {
  it("trims the label and rejects empty or over-long labels", () => {
    expect(allowlistAddSchema.parse({ recipient: "acme-corp", label: "  Acme Corp " })).toEqual({
      recipient: "acme-corp",
      label: "Acme Corp",
    });
    expect(() => allowlistAddSchema.parse({ recipient: "x", label: "   " })).toThrow();
    expect(() => allowlistAddSchema.parse({ recipient: "x", label: "y".repeat(65) })).toThrow();
  });
});

describe("agentRunSchema", () => {
  it("requires a scenario or a prompt, and caps prompt length", () => {
    expect(agentRunSchema.parse({ scenario: "happy_path" })).toEqual({ scenario: "happy_path" });
    expect(agentRunSchema.parse({ prompt: "pay the vendor" })).toEqual({ prompt: "pay the vendor" });
    expect(() => agentRunSchema.parse({})).toThrow(/either scenario or prompt/);
    expect(() => agentRunSchema.parse({ scenario: "nope" })).toThrow();
    expect(() => agentRunSchema.parse({ prompt: "x".repeat(2001) })).toThrow();
  });
});

describe("auditQuerySchema", () => {
  it("coerces query strings and defaults the limit to 50", () => {
    expect(auditQuerySchema.parse({ afterSeq: "12", outcome: "REJECTED" })).toEqual({
      afterSeq: 12,
      limit: 50,
      outcome: "REJECTED",
    });
    expect(() => auditQuerySchema.parse({ limit: "0" })).toThrow();
    expect(() => auditQuerySchema.parse({ limit: "201" })).toThrow();
    expect(() => auditQuerySchema.parse({ outcome: "MAYBE" })).toThrow();
  });
});
