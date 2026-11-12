import { describe, expect, it } from "vitest";

import { LiveAgentError } from "../../src/agents/live.js";
import { runAgent } from "../../src/agents/run.js";
import { setFrozen } from "../../src/services/config.js";
import { createRepositories } from "../../src/db/repositories.js";
import { submitProposal } from "../../src/services/proposals.js";
import { InvalidInputError } from "../../src/shared/errors.js";
import { makeTestDb } from "../helpers.js";

describe("runAgent: scripted scenarios end to end", () => {
  it("happy_path approves and executes", async () => {
    const { db, clock, sandbox } = makeTestDb();
    const res = await runAgent(db, clock, sandbox.id, { scenario: "happy_path" }, { agentMode: "scripted" });
    expect(res.agentMode).toBe("scripted");
    expect(res.scenario).toBe("happy_path");
    expect(res.proposals).toHaveLength(1);
    expect(res.proposals[0]!.outcome).toBe("APPROVED");
    expect(res.proposals[0]!.status).toBe("EXECUTED");
  });

  it("over_per_tx is rejected by the per-tx cap with no payment", async () => {
    const { db, clock, sandbox } = makeTestDb();
    const res = await runAgent(db, clock, sandbox.id, { scenario: "over_per_tx" }, { agentMode: "scripted" });
    expect(res.proposals[0]!.outcome).toBe("REJECTED");
    expect(res.proposals[0]!.reason).toBe("PER_TX_CAP_EXCEEDED");
    expect(createRepositories(db).payments.countBySandbox(sandbox.id)).toBe(0);
  });

  it("over_daily fills the cap, then the probe is rejected by the daily cap", async () => {
    const { db, clock, sandbox } = makeTestDb();
    const res = await runAgent(db, clock, sandbox.id, { scenario: "over_daily" }, { agentMode: "scripted" });
    expect(res.proposals.map((p) => p.outcome)).toEqual(["APPROVED", "APPROVED", "REJECTED"]);
    expect(res.proposals[2]!.reason).toBe("DAILY_CAP_EXCEEDED");
    expect(createRepositories(db).payments.totalBySandbox(sandbox.id)).toBe(100_000);
  });

  it("unknown_recipient is rejected by the allowlist", async () => {
    const { db, clock, sandbox } = makeTestDb();
    const res = await runAgent(db, clock, sandbox.id, { scenario: "unknown_recipient" }, { agentMode: "scripted" });
    expect(res.proposals[0]!.reason).toBe("RECIPIENT_NOT_ALLOWED");
  });

  it("frozen is rejected while frozen and approved while not", async () => {
    const { db, clock, sandbox } = makeTestDb();
    setFrozen(db, clock, sandbox.id, { frozen: true }, "operator");
    const frozenRes = await runAgent(db, clock, sandbox.id, { scenario: "frozen" }, { agentMode: "scripted" });
    expect(frozenRes.proposals[0]!.reason).toBe("SYSTEM_FROZEN");
    setFrozen(db, clock, sandbox.id, { frozen: false }, "operator");
    const thawedRes = await runAgent(db, clock, sandbox.id, { scenario: "frozen" }, { agentMode: "scripted" });
    expect(thawedRes.proposals[0]!.outcome).toBe("APPROVED");
  });

  it("prompt_injection is rejected and the memo never influences the verdict", async () => {
    const { db, clock, sandbox } = makeTestDb();
    const res = await runAgent(db, clock, sandbox.id, { scenario: "prompt_injection" }, { agentMode: "scripted" });
    const reasons = res.proposals[0]!.reasons;
    expect(res.proposals[0]!.outcome).toBe("REJECTED");
    expect(reasons.find((r) => r.rule === "ALLOWLIST")?.passed).toBe(false);
    expect(reasons.find((r) => r.rule === "PER_TX_CAP")?.passed).toBe(false);
  });

  it("each run generates fresh idempotency keys, so repeats are new proposals", async () => {
    const { db, clock, sandbox } = makeTestDb();
    await runAgent(db, clock, sandbox.id, { scenario: "happy_path" }, { agentMode: "scripted" });
    const second = await runAgent(db, clock, sandbox.id, { scenario: "happy_path" }, { agentMode: "scripted" });
    expect(second.proposals[0]!.replayed).toBe(false);
    expect(createRepositories(db).proposals.countBySandbox(sandbox.id)).toBe(2);
  });

  it("rejects an unknown scenario and an empty run request", async () => {
    const { db, clock, sandbox } = makeTestDb();
    await expect(runAgent(db, clock, sandbox.id, { scenario: "nope" }, { agentMode: "scripted" })).rejects.toThrow(
      InvalidInputError,
    );
    await expect(runAgent(db, clock, sandbox.id, {}, { agentMode: "scripted" })).rejects.toThrow(InvalidInputError);
  });

  it("refuses a bare prompt when the live agent is disabled", async () => {
    const { db, clock, sandbox } = makeTestDb();
    await expect(runAgent(db, clock, sandbox.id, { prompt: "pay acme $100" }, { agentMode: "scripted" })).rejects.toThrow(
      InvalidInputError,
    );
  });
});

describe("runAgent: live mode and fallback", () => {
  it("submits live proposals through the same path and reports live mode", async () => {
    const { db, clock, sandbox } = makeTestDb();
    const res = await runAgent(
      db,
      clock,
      sandbox.id,
      { prompt: "pay acme $100" },
      {
        agentMode: "live",
        liveAgent: {
          run: async () => [{ recipient: "acme-corp", amountCents: 10_000, currency: "USD", memo: "live" }],
        },
      },
    );
    expect(res.agentMode).toBe("live");
    expect(res.proposals[0]!.outcome).toBe("APPROVED");
  });

  it("falls back to the scripted happy_path when the live agent fails", async () => {
    const { db, clock, sandbox } = makeTestDb();
    const res = await runAgent(
      db,
      clock,
      sandbox.id,
      { prompt: "pay acme $100" },
      {
        agentMode: "live",
        liveAgent: {
          run: async () => {
            throw new LiveAgentError("provider down");
          },
        },
      },
    );
    expect(res.agentMode).toBe("scripted_fallback");
    expect(res.scenario).toBe("happy_path");
    expect(res.proposals[0]!.outcome).toBe("APPROVED");
  });

  it("does not swallow non-live errors from the agent", async () => {
    const { db, clock, sandbox } = makeTestDb();
    await expect(
      runAgent(
        db,
        clock,
        sandbox.id,
        { prompt: "pay" },
        {
          agentMode: "live",
          liveAgent: {
            run: async () => {
              throw new Error("programmer error");
            },
          },
        },
      ),
    ).rejects.toThrow("programmer error");
  });
});

describe("agent boundary: a hostile agent cannot inject a verdict", () => {
  it("extra fields claiming approval are stripped; the engine still rejects", () => {
    const { db, clock, sandbox } = makeTestDb();
    const res = submitProposal(
      db,
      clock,
      sandbox.id,
      {
        recipient: "acme-corp",
        amountCents: 75_000,
        currency: "USD",
        memo: "trust me",
        approved: true,
        outcome: "APPROVED",
        snapshot: { perTxCapCents: 999_999_999 },
        reasons: [],
      },
      "agent:scripted",
    );
    expect(res.outcome).toBe("REJECTED");
    expect(res.reason).toBe("PER_TX_CAP_EXCEEDED");
    expect(res.reasons).toHaveLength(4);
  });
});
