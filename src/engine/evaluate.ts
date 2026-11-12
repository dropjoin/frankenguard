import type { ConfigSnapshot, Decision, Reason, ValidProposal } from "../shared/types.js";
import { evaluateAllowlist } from "./rules/allowlist.js";
import { evaluateDailyCap } from "./rules/dailyCap.js";
import { evaluateFreeze } from "./rules/freeze.js";
import { evaluatePerTxCap } from "./rules/perTxCap.js";

// The combiner. Fixed rule order, all four rules always evaluated even
// after a failure, exactly one reason per rule. APPROVED if and only if
// every rule passes. The memo is never read here: the decision depends
// on the validated proposal, the frozen snapshot, and the ledger total,
// and on nothing the agent wrote to justify itself (R1.10, R2.10).

export interface EvaluationInput {
  proposal: ValidProposal;
  snapshot: ConfigSnapshot;
  dailySpentCents: number;
}

export function evaluateProposal(input: EvaluationInput): Decision {
  const { proposal, snapshot, dailySpentCents } = input;
  const reasons: Reason[] = [
    evaluateFreeze(snapshot.frozen),
    evaluateAllowlist(proposal.recipientKey, snapshot.allowlist),
    evaluatePerTxCap(proposal.amountCents, snapshot.perTxCapCents),
    evaluateDailyCap({
      amountCents: proposal.amountCents,
      dailySpentCents,
      dailyCapCents: snapshot.dailyCapCents,
    }),
  ];
  const firstFailure = reasons.find((reason) => !reason.passed);
  return {
    outcome: firstFailure === undefined ? "APPROVED" : "REJECTED",
    reason: firstFailure === undefined ? "APPROVED" : firstFailure.code,
    reasons,
    snapshot,
  };
}
