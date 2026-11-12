import { describe, expect, it } from "vitest";

import { evaluateAllowlist } from "../../src/engine/rules/allowlist.js";
import { evaluateDailyCap } from "../../src/engine/rules/dailyCap.js";
import { evaluateFreeze } from "../../src/engine/rules/freeze.js";
import { evaluatePerTxCap } from "../../src/engine/rules/perTxCap.js";

describe("freeze rule", () => {
  it("passes when unfrozen and fails with SYSTEM_FROZEN when frozen", () => {
    expect(evaluateFreeze(false)).toMatchObject({ passed: true, code: "NOT_FROZEN", rule: "FREEZE" });
    expect(evaluateFreeze(true)).toMatchObject({ passed: false, code: "SYSTEM_FROZEN", rule: "FREEZE" });
  });

  it("carries the frozen state in the detail", () => {
    expect(evaluateFreeze(true).detail).toEqual({ frozen: true });
    expect(evaluateFreeze(false).detail).toEqual({ frozen: false });
  });
});

describe("allowlist rule", () => {
  it("passes on an exact normalized match", () => {
    expect(evaluateAllowlist("acme-corp", ["acme-corp", "globex-corp"])).toMatchObject({
      passed: true,
      code: "RECIPIENT_ALLOWED",
    });
  });

  it("fails on a miss and on an empty list", () => {
    expect(evaluateAllowlist("evil.com", ["acme-corp"])).toMatchObject({
      passed: false,
      code: "RECIPIENT_NOT_ALLOWED",
    });
    expect(evaluateAllowlist("acme-corp", [])).toMatchObject({ passed: false });
  });

  it("never matches prefixes, substrings, or case variants", () => {
    expect(evaluateAllowlist("acme", ["acme-corp"]).passed).toBe(false);
    expect(evaluateAllowlist("acme-corp-evil", ["acme-corp"]).passed).toBe(false);
    expect(evaluateAllowlist("ACME-CORP", ["acme-corp"]).passed).toBe(false);
    expect(evaluateAllowlist("xacme-corpx", ["acme-corp"]).passed).toBe(false);
  });
});

describe("per-transaction cap rule", () => {
  it("is inclusive: cap-1 and cap pass, cap+1 fails", () => {
    expect(evaluatePerTxCap(49999, 50000)).toMatchObject({ passed: true, code: "WITHIN_PER_TX_CAP" });
    expect(evaluatePerTxCap(50000, 50000)).toMatchObject({ passed: true });
    expect(evaluatePerTxCap(50001, 50000)).toMatchObject({ passed: false, code: "PER_TX_CAP_EXCEEDED" });
  });

  it("names both amounts in the message and detail", () => {
    const failed = evaluatePerTxCap(75000, 50000);
    expect(failed.message).toBe("$750.00 exceeds the per-transaction cap of $500.00.");
    expect(failed.detail).toEqual({ amountCents: 75000, perTxCapCents: 50000 });
  });
});

describe("daily cap rule", () => {
  it("is inclusive on the total: spent + amount equal to the cap passes", () => {
    expect(evaluateDailyCap({ amountCents: 10000, dailySpentCents: 90000, dailyCapCents: 100000 })).toMatchObject({
      passed: true,
      code: "WITHIN_DAILY_CAP",
    });
    expect(evaluateDailyCap({ amountCents: 10001, dailySpentCents: 90000, dailyCapCents: 100000 })).toMatchObject({
      passed: false,
      code: "DAILY_CAP_EXCEEDED",
    });
  });

  it("fails when spending already exceeds the cap, even for a tiny proposal", () => {
    expect(evaluateDailyCap({ amountCents: 1, dailySpentCents: 100000, dailyCapCents: 100000 })).toMatchObject({
      passed: false,
    });
    expect(evaluateDailyCap({ amountCents: 1, dailySpentCents: 120000, dailyCapCents: 100000 })).toMatchObject({
      passed: false,
    });
  });

  it("reports the headroom before the proposal in remainingCents", () => {
    const reason = evaluateDailyCap({ amountCents: 10000, dailySpentCents: 30000, dailyCapCents: 100000 });
    expect(reason.detail).toEqual({
      amountCents: 10000,
      dailySpentCents: 30000,
      dailyCapCents: 100000,
      remainingCents: 70000,
    });
  });

  it("names the arithmetic in the message", () => {
    const failed = evaluateDailyCap({ amountCents: 20000, dailySpentCents: 90000, dailyCapCents: 100000 });
    expect(failed.message).toBe(
      "$900.00 spent today + $200.00 proposed = $1,100.00, over the $1,000.00 daily cap.",
    );
  });
});
