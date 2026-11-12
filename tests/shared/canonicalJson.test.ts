import { describe, expect, it } from "vitest";

import { canonicalJson } from "../../src/shared/canonicalJson.js";

describe("canonicalJson", () => {
  it("sorts keys, including nested ones, with no whitespace", () => {
    expect(canonicalJson({ b: 1, a: { d: 4, c: 3 } })).toBe('{"a":{"c":3,"d":4},"b":1}');
  });

  it("produces identical output regardless of insertion order", () => {
    const one = canonicalJson({ seq: 2, type: "X", payload: { b: 1, a: 2 } });
    const two = canonicalJson({ payload: { a: 2, b: 1 }, type: "X", seq: 2 });
    expect(one).toBe(two);
  });

  it("keeps array order and handles nulls, booleans, and strings", () => {
    expect(canonicalJson({ list: [3, 1, 2], nil: null, yes: true, s: "a\"b" })).toBe(
      '{"list":[3,1,2],"nil":null,"s":"a\\"b","yes":true}',
    );
  });

  it("normalizes -0 to 0", () => {
    expect(canonicalJson({ n: -0 })).toBe('{"n":0}');
  });

  it("rejects floats, NaN, and Infinity", () => {
    expect(() => canonicalJson({ n: 1.5 })).toThrow("not canonical JSON data");
    expect(() => canonicalJson({ n: Number.NaN })).toThrow("not canonical JSON data");
    expect(() => canonicalJson({ n: Number.POSITIVE_INFINITY })).toThrow("not canonical JSON data");
    expect(() => canonicalJson([0.1])).toThrow("not canonical JSON data");
  });

  it("rejects undefined, functions, bigint, and non-plain objects", () => {
    expect(() => canonicalJson({ n: undefined })).toThrow("not canonical JSON data");
    expect(() => canonicalJson({ n: () => 1 })).toThrow("not canonical JSON data");
    expect(() => canonicalJson({ n: 10n })).toThrow("not canonical JSON data");
    expect(() => canonicalJson({ n: new Date() })).toThrow("non-plain object");
  });

  it("rejects unsafe integers", () => {
    expect(() => canonicalJson({ n: Number.MAX_SAFE_INTEGER + 1 })).toThrow("not canonical JSON data");
  });
});
