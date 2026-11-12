import { describe, expect, it } from "vitest";

import { FakeClock } from "../../src/shared/clock.js";
import { newSandboxId, newUlid } from "../../src/shared/ids.js";

const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

describe("newUlid", () => {
  it("produces 26 Crockford base32 chars", () => {
    expect(newUlid()).toMatch(ULID_RE);
  });

  it("encodes the clock time in the first 10 chars, so ids sort by creation time", () => {
    const earlier = newUlid(new FakeClock("2026-11-13T00:00:00.000Z"));
    const later = newUlid(new FakeClock("2026-11-13T00:00:01.000Z"));
    expect(earlier < later).toBe(true);
    expect(earlier.slice(0, 10)).not.toBe(later.slice(0, 10));
  });

  it("never repeats across 10,000 ids from the same millisecond", () => {
    const clock = new FakeClock("2026-11-13T00:00:00.000Z");
    const ids = new Set(Array.from({ length: 10_000 }, () => newUlid(clock)));
    expect(ids.size).toBe(10_000);
  });
});

describe("newSandboxId", () => {
  it("is 22 base64url chars", () => {
    expect(newSandboxId()).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it("never repeats", () => {
    const ids = new Set(Array.from({ length: 10_000 }, () => newSandboxId()));
    expect(ids.size).toBe(10_000);
  });
});
