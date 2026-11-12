// Time is always injected. No module outside this one reads the system
// clock, which is what makes the UTC-midnight and expiry tests honest:
// they move a FakeClock instead of waiting for midnight.

export interface Clock {
  now(): Date;
  nowIso(): string;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  nowIso(): string {
    return new Date().toISOString();
  }
}

/** A clock the tests drive by hand. Starts at `start`, moves only when told. */
export class FakeClock implements Clock {
  private ms: number;

  constructor(start: Date | string) {
    this.ms = new Date(start).getTime();
    if (Number.isNaN(this.ms)) throw new Error(`FakeClock got an invalid start time: ${String(start)}`);
  }

  now(): Date {
    return new Date(this.ms);
  }

  nowIso(): string {
    return new Date(this.ms).toISOString();
  }

  /** Move forward by exactly `ms` milliseconds. Refuses to move backward: a clock that rewinds would let the daily window double-count. */
  advanceMs(ms: number): void {
    if (!Number.isSafeInteger(ms) || ms < 0) {
      throw new Error(`FakeClock.advanceMs expects a non-negative integer, got ${ms}`);
    }
    this.ms += ms;
  }

  advanceMinutes(minutes: number): void {
    this.advanceMs(minutes * 60_000);
  }

  set(at: Date | string): void {
    const ms = new Date(at).getTime();
    if (Number.isNaN(ms)) throw new Error(`FakeClock.set got an invalid time: ${String(at)}`);
    this.ms = ms;
  }
}
