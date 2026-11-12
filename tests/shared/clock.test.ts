import { describe, expect, it } from "vitest";

import { FakeClock, SystemClock } from "../../src/shared/clock.js";

describe("SystemClock", () => {
  it("tracks the real clock", () => {
    const before = Date.now();
    const clock = new SystemClock();
    const at = clock.now().getTime();
    expect(at).toBeGreaterThanOrEqual(before);
    expect(at).toBeLessThanOrEqual(Date.now());
    expect(clock.nowIso()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});

describe("FakeClock", () => {
  it("starts where told and only moves when advanced", () => {
    const clock = new FakeClock("2026-11-13T00:00:00.000Z");
    expect(clock.nowIso()).toBe("2026-11-13T00:00:00.000Z");
    clock.advanceMs(1500);
    expect(clock.nowIso()).toBe("2026-11-13T00:00:01.500Z");
    clock.advanceMinutes(90);
    expect(clock.nowIso()).toBe("2026-11-13T01:30:01.500Z");
  });

  it("set() jumps to an explicit time", () => {
    const clock = new FakeClock("2026-11-13T00:00:00.000Z");
    clock.set("2026-12-05T05:00:00.000Z");
    expect(clock.nowIso()).toBe("2026-12-05T05:00:00.000Z");
  });

  it("refuses to move backward through advanceMs", () => {
    const clock = new FakeClock("2026-11-13T00:00:00.000Z");
    expect(() => clock.advanceMs(-1)).toThrow("non-negative");
  });

  it("refuses invalid start times", () => {
    expect(() => new FakeClock("not a date")).toThrow("invalid start time");
  });
});
