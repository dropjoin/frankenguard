import { describe, expect, it } from "vitest";

import { MS_PER_DAY, utcDayWindow } from "../../src/engine/window.js";

describe("utcDayWindow", () => {
  it("starts at UTC midnight and ends at the next midnight", () => {
    const at = Date.parse("2026-11-13T15:30:00.000Z");
    const { startMs, endMs } = utcDayWindow(at);
    expect(new Date(startMs).toISOString()).toBe("2026-11-13T00:00:00.000Z");
    expect(new Date(endMs).toISOString()).toBe("2026-11-14T00:00:00.000Z");
    expect(endMs - startMs).toBe(MS_PER_DAY);
  });

  it("assigns 23:59:59.999Z and 00:00:00.000Z to different days", () => {
    const before = utcDayWindow(Date.parse("2026-11-13T23:59:59.999Z"));
    const after = utcDayWindow(Date.parse("2026-11-14T00:00:00.000Z"));
    expect(before.startMs).not.toBe(after.startMs);
    expect(after.startMs).toBe(before.endMs);
  });

  it("handles leap day and month/year boundaries", () => {
    const leap = utcDayWindow(Date.parse("2024-02-29T12:00:00.000Z"));
    expect(new Date(leap.startMs).toISOString()).toBe("2024-02-29T00:00:00.000Z");
    expect(new Date(leap.endMs).toISOString()).toBe("2024-03-01T00:00:00.000Z");
    const newYear = utcDayWindow(Date.parse("2026-12-31T23:00:00.000Z"));
    expect(new Date(newYear.endMs).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("is stable at the epoch", () => {
    expect(utcDayWindow(0)).toEqual({ startMs: 0, endMs: MS_PER_DAY });
  });

  it("rejects negative and non-integer input", () => {
    expect(() => utcDayWindow(-1)).toThrow("non-negative integer");
    expect(() => utcDayWindow(1.5)).toThrow("non-negative integer");
  });
});
