import { describe, expect, it } from "vitest";

import { formatUsd, parseDecimalToCents } from "../../src/shared/money.js";

describe("formatUsd", () => {
  it("formats the spec example", () => {
    expect(formatUsd(75000)).toBe("$750.00");
  });

  it("formats zero, small amounts, and large amounts with separators", () => {
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(1)).toBe("$0.01");
    expect(formatUsd(1999)).toBe("$19.99");
    expect(formatUsd(100000000)).toBe("$1,000,000.00");
    expect(formatUsd(1000000000)).toBe("$10,000,000.00");
  });

  it("puts the sign before the dollar sign", () => {
    expect(formatUsd(-500)).toBe("-$5.00");
  });

  it("refuses anything that is not a safe integer", () => {
    expect(() => formatUsd(19.99)).toThrow("integer cents");
    expect(() => formatUsd(Number.NaN)).toThrow("integer cents");
    expect(() => formatUsd(Number.MAX_SAFE_INTEGER + 1)).toThrow("integer cents");
  });
});

describe("parseDecimalToCents", () => {
  it("parses plain dollars and cents", () => {
    expect(parseDecimalToCents("180")).toEqual({ ok: true, cents: 18000 });
    expect(parseDecimalToCents("19.99")).toEqual({ ok: true, cents: 1999 });
    expect(parseDecimalToCents("180.5")).toEqual({ ok: true, cents: 18050 });
    expect(parseDecimalToCents("0.01")).toEqual({ ok: true, cents: 1 });
  });

  it("accepts a leading dollar sign, whitespace, and well-formed grouping", () => {
    expect(parseDecimalToCents("  $1,234.56 ")).toEqual({ ok: true, cents: 123456 });
    expect(parseDecimalToCents("$180")).toEqual({ ok: true, cents: 18000 });
  });

  it("rejects the traps, each with its own reason", () => {
    expect(parseDecimalToCents("")).toMatchObject({ ok: false });
    expect(parseDecimalToCents("1e3")).toMatchObject({ ok: false, error: expect.stringMatching(/scientific/) });
    expect(parseDecimalToCents("1.234")).toMatchObject({ ok: false, error: expect.stringMatching(/two decimal/) });
    expect(parseDecimalToCents("1,2,3")).toMatchObject({ ok: false, error: expect.stringMatching(/grouping/) });
    expect(parseDecimalToCents("1.234,56")).toMatchObject({ ok: false });
    expect(parseDecimalToCents("١٢٣")).toMatchObject({ ok: false, error: expect.stringMatching(/non-ASCII/) });
    expect(parseDecimalToCents("180.")).toMatchObject({ ok: false });
    expect(parseDecimalToCents(".5")).toMatchObject({ ok: false });
    expect(parseDecimalToCents("0")).toMatchObject({ ok: false, error: expect.stringMatching(/positive/) });
    expect(parseDecimalToCents("-5")).toMatchObject({ ok: false });
    expect(parseDecimalToCents("10,000,000.01")).toMatchObject({ ok: false, error: expect.stringMatching(/ceiling/) });
    expect(parseDecimalToCents("abc")).toMatchObject({ ok: false });
    expect(parseDecimalToCents("12a")).toMatchObject({ ok: false });
  });

  it("accepts exactly the ceiling", () => {
    expect(parseDecimalToCents("10000000")).toEqual({ ok: true, cents: 1000000000 });
  });
});
