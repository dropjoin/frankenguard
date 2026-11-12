import type Database from "better-sqlite3";

import { createRepositories } from "../db/repositories.js";
import { utcDayWindow } from "../engine/window.js";
import type { Clock } from "../shared/clock.js";
import { InvalidInputError } from "../shared/errors.js";
import { newUlid } from "../shared/ids.js";
import { agentRunSchema, type ScenarioId } from "../shared/types.js";
import { submitProposal, type SubmitFaults } from "../services/proposals.js";
import { DEFAULT_DAILY_CAP_CENTS, DEFAULT_PER_TX_CAP_CENTS } from "../services/sandbox.js";
import { LiveAgentError, type LiveAgent } from "./live.js";
import { getScenario } from "./scripted.js";
import type { AgentProposal, AgentRunResult, ScenarioContext } from "./types.js";

// Agent run orchestration: the only code that turns an agent run into
// submitted proposals. Scenario runs are deterministic. Prompt runs
// need the live agent; with the live agent disabled a bare prompt is
// refused rather than silently reinterpreted, and a live failure
// falls back to the happy_path scenario with agentMode
// "scripted_fallback" so the demo keeps working and says so.
//
// Every proposal is submitted through ProposalService with a
// server-generated idempotency key, actor "agent:scripted". The
// agent never writes to the database directly, and anything extra an
// agent returns is stripped by validation before the engine sees it.

export interface AgentRunOptions {
  /** "live" only when the server was started with AGENT_PROVIDER=live and a key. */
  agentMode: "scripted" | "live";
  liveAgent?: LiveAgent;
  faults?: SubmitFaults;
}

function readContext(db: Database.Database, clock: Clock, sandboxId: string): ScenarioContext {
  try {
    const repos = createRepositories(db);
    const config = repos.config.getBySandbox(sandboxId);
    const window = utcDayWindow(clock.now().getTime());
    const spent = repos.payments.sumForWindow(
      sandboxId,
      new Date(window.startMs).toISOString(),
      new Date(window.endMs).toISOString(),
    );
    return {
      perTxCapCents: config?.per_tx_cap_cents ?? DEFAULT_PER_TX_CAP_CENTS,
      dailyCapCents: config?.daily_cap_cents ?? DEFAULT_DAILY_CAP_CENTS,
      dailySpentCents: spent,
      frozen: config?.frozen === 1,
    };
  } catch {
    // Sizing context is advisory: if the state cannot be read, the
    // submits themselves fail closed. Size against the defaults.
    return {
      perTxCapCents: DEFAULT_PER_TX_CAP_CENTS,
      dailyCapCents: DEFAULT_DAILY_CAP_CENTS,
      dailySpentCents: 0,
      frozen: false,
    };
  }
}

function submitAll(
  db: Database.Database,
  clock: Clock,
  sandboxId: string,
  proposals: AgentProposal[],
  faults?: SubmitFaults,
): AgentRunResult["proposals"] {
  return proposals.map((proposal) =>
    submitProposal(
      db,
      clock,
      sandboxId,
      { ...proposal, idempotencyKey: newUlid(clock) },
      "agent:scripted",
      faults ?? {},
    ),
  );
}

export async function runAgent(
  db: Database.Database,
  clock: Clock,
  sandboxId: string,
  input: unknown,
  options: AgentRunOptions,
): Promise<AgentRunResult> {
  const parsed = agentRunSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new InvalidInputError(first ? `${String(first.path[0] ?? "input")}: ${first.message}` : "invalid input");
  }
  const ctx = readContext(db, clock, sandboxId);

  // A named scenario always wins over a prompt: deterministic beats interpreted.
  if (parsed.data.scenario !== undefined) {
    const scenario: ScenarioId = parsed.data.scenario;
    const proposals = getScenario(scenario)(ctx);
    return { agentMode: "scripted", scenario, proposals: submitAll(db, clock, sandboxId, proposals, options.faults) };
  }

  const prompt = parsed.data.prompt ?? "";
  if (options.agentMode !== "live" || !options.liveAgent) {
    throw new InvalidInputError("a free-text prompt needs the live agent, which is disabled");
  }
  try {
    const proposals = await options.liveAgent.run(prompt);
    return { agentMode: "live", proposals: submitAll(db, clock, sandboxId, proposals, options.faults) };
  } catch (error) {
    if (!(error instanceof LiveAgentError)) throw error;
    const proposals = getScenario("happy_path")(ctx);
    return {
      agentMode: "scripted_fallback",
      scenario: "happy_path",
      proposals: submitAll(db, clock, sandboxId, proposals, options.faults),
    };
  }
}
