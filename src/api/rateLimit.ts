// Token-bucket rate limiting. One bucket per key, refilled linearly.
// The clock is passed in at check time so tests can drive time with a
// FakeClock instead of sleeping. Buckets are pruned opportunistically
// so a long-lived server does not grow a map entry per visitor
// forever: full buckets idle for 10 minutes are dropped when the map
// passes 1,000 entries.

export interface LimitVerdict {
  allowed: boolean;
  retryAfterSeconds: number;
}

interface Bucket {
  tokens: number;
  updatedMs: number;
}

const PRUNE_THRESHOLD = 1000;
const PRUNE_IDLE_MS = 10 * 60 * 1000;

export class TokenBucket {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly capacity: number,
    private readonly refillPerMs: number,
  ) {}

  take(key: string, nowMs: number): LimitVerdict {
    const existing = this.buckets.get(key);
    const bucket: Bucket = existing ?? { tokens: this.capacity, updatedMs: nowMs };
    const elapsed = Math.max(0, nowMs - bucket.updatedMs);
    bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsed * this.refillPerMs);
    bucket.updatedMs = nowMs;
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      this.buckets.set(key, bucket);
      return { allowed: true, retryAfterSeconds: 0 };
    }
    const deficit = 1 - bucket.tokens;
    const retryAfterSeconds = Math.max(1, Math.ceil(deficit / this.refillPerMs / 1000));
    this.buckets.set(key, bucket);
    this.prune(nowMs);
    return { allowed: false, retryAfterSeconds };
  }

  private prune(nowMs: number): void {
    if (this.buckets.size <= PRUNE_THRESHOLD) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.tokens >= this.capacity && nowMs - bucket.updatedMs > PRUNE_IDLE_MS) {
        this.buckets.delete(key);
      }
    }
  }
}

/** The five buckets of design 6.5, with their capacities and windows. */
export function createLimiters(): {
  perSandboxWrite: TokenBucket;
  perSandboxRead: TokenBucket;
  perIp: TokenBucket;
  liveAgent: TokenBucket;
  sandboxCreation: TokenBucket;
} {
  const perMinute = (n: number) => n / 60_000;
  return {
    perSandboxWrite: new TokenBucket(30, perMinute(30)),
    perSandboxRead: new TokenBucket(120, perMinute(120)),
    perIp: new TokenBucket(120, perMinute(120)),
    liveAgent: new TokenBucket(6, perMinute(6)),
    sandboxCreation: new TokenBucket(10, 10 / 3_600_000),
  };
}

export type Limiters = ReturnType<typeof createLimiters>;
