// The daily window is a UTC calendar day: [00:00:00.000Z, 24:00:00.000Z).
// UTC days are exactly 86,400,000 ms with no DST, so the window is pure
// integer arithmetic on the epoch millisecond count. No Date, no clock
// reads: this module stays inside the engine purity guard, and the
// service converts milliseconds to ISO strings at the storage boundary.

export const MS_PER_DAY = 86_400_000;

export interface DayWindow {
  /** Inclusive start: UTC midnight, epoch ms. */
  startMs: number;
  /** Exclusive end: the next UTC midnight, epoch ms. */
  endMs: number;
}

export function utcDayWindow(nowMs: number): DayWindow {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
    throw new Error(`utcDayWindow expects a non-negative integer epoch ms, got ${String(nowMs)}`);
  }
  const startMs = Math.floor(nowMs / MS_PER_DAY) * MS_PER_DAY;
  return { startMs, endMs: startMs + MS_PER_DAY };
}
