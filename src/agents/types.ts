import type { ProposalResponse, ScenarioId } from "../shared/types.js";

// The agent layer's contract: an agent produces proposals, nothing
// else. It never sees caps, spend, or past verdicts, and it never
// touches the database. The run orchestration submits whatever an
// agent returns through the same ProposalService path a manual form
// uses, so an agent cannot approve its own work.

export type AgentMode = "scripted" | "live" | "scripted_fallback";

export interface AgentProposal {
  recipient: string;
  amountCents: number;
  currency: "USD";
  memo: string;
}

export interface AgentRunResult {
  agentMode: AgentMode;
  scenario?: ScenarioId;
  proposals: ProposalResponse[];
}

/** What a scenario may know about current state, for sizing its proposals. Caps and spend only; never verdicts. */
export interface ScenarioContext {
  perTxCapCents: number;
  dailyCapCents: number;
  dailySpentCents: number;
  frozen: boolean;
}

export type ScenarioFn = (ctx: ScenarioContext) => AgentProposal[];
