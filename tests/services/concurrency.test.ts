import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { openDb } from "../../src/db/migrate.js";
import { createRepositories } from "../../src/db/repositories.js";
import { verifyChain } from "../../src/services/audit/chain.js";
import { submitProposal } from "../../src/services/proposals.js";
import { createSandbox } from "../../src/services/sandbox.js";
import { FakeClock } from "../../src/shared/clock.js";

// Concurrency (task 3.5): 200 randomized submissions across several
// connections to one file-backed database. better-sqlite3 is
// synchronous, so true parallelism is simulated with interleaved
// connections and a shared WAL file; BEGIN IMMEDIATE serializes the
// writers, and the invariant is that total executed spend never
// exceeds the daily cap and the chain stays valid.

describe("concurrent submissions", () => {
  it("never lets total executed spend exceed the daily cap", () => {
    const dir = mkdtempSync(join(tmpdir(), "frankenguard-concurrency-"));
    const dbPath = join(dir, "test.db");
    try {
      const setupDb = openDb(dbPath);
      const clock = new FakeClock("2026-11-13T12:00:00.000Z");
      const sandbox = createSandbox(setupDb, clock);
      setupDb.close();

      const connections = [openDb(dbPath), openDb(dbPath), openDb(dbPath), openDb(dbPath)];
      try {
        // Deterministic pseudo-random amounts: 5_000..54_999 cents.
        let seed = 42;
        const nextAmount = () => {
          seed = (seed * 1103515245 + 12345) & 0x7fffffff;
          return 5_000 + (seed % 50_000);
        };
        const results: { outcome: string; amountCents: number }[] = [];
        for (let i = 0; i < 200; i++) {
          const conn = connections[i % connections.length]!;
          const amountCents = nextAmount();
          const res = submitProposal(
            conn,
            clock,
            sandbox.id,
            { recipient: "acme-corp", amountCents, currency: "USD", memo: `race ${i}` },
            "agent:scripted",
          );
          results.push({ outcome: res.outcome, amountCents });
        }
        const executed = results.filter((r) => r.outcome === "APPROVED").reduce((sum, r) => sum + r.amountCents, 0);
        expect(executed).toBeLessThanOrEqual(100_000);

        const checkDb = connections[0]!;
        const repos = createRepositories(checkDb);
        expect(repos.proposals.countBySandbox(sandbox.id)).toBe(200);
        expect(repos.payments.totalBySandbox(sandbox.id)).toBe(executed);
        expect(verifyChain(checkDb, sandbox.id).ok).toBe(true);
        // No two decisions share a proposal, and every proposal has exactly one decision.
        const proposalIds = checkDb
          .prepare("SELECT id FROM proposals WHERE sandbox_id = ?")
          .all(sandbox.id) as { id: string }[];
        expect(new Set(proposalIds.map((p) => p.id)).size).toBe(200);
        const decisionCount = checkDb
          .prepare("SELECT COUNT(*) AS n FROM decisions WHERE proposal_id IN (SELECT id FROM proposals WHERE sandbox_id = ?)")
          .get(sandbox.id) as { n: number };
        expect(decisionCount.n).toBe(200);
      } finally {
        for (const conn of connections) conn.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
