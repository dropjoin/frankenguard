import { formatUsd } from "../../shared/money.js";
import type { Reason } from "../../shared/types.js";

// Rule 4 of 4. Inclusive: spent + amount exactly equal to the cap
// passes (R3.3). remainingCents is the headroom left BEFORE this
// proposal, the same number the spend meter shows.

export function evaluateDailyCap(args: {
  amountCents: number;
  dailySpentCents: number;
  dailyCapCents: number;
}): Reason {
  const { amountCents, dailySpentCents, dailyCapCents } = args;
  const remainingCents = dailyCapCents - dailySpentCents;
  const totalCents = dailySpentCents + amountCents;
  if (totalCents > dailyCapCents) {
    return {
      rule: "DAILY_CAP",
      passed: false,
      code: "DAILY_CAP_EXCEEDED",
      message: `${formatUsd(dailySpentCents)} spent today + ${formatUsd(amountCents)} proposed = ${formatUsd(totalCents)}, over the ${formatUsd(dailyCapCents)} daily cap.`,
      detail: { amountCents, dailySpentCents, dailyCapCents, remainingCents },
    };
  }
  return {
    rule: "DAILY_CAP",
    passed: true,
    code: "WITHIN_DAILY_CAP",
    message: `${formatUsd(dailySpentCents)} spent today + ${formatUsd(amountCents)} proposed = ${formatUsd(totalCents)}, within the ${formatUsd(dailyCapCents)} daily cap.`,
    detail: { amountCents, dailySpentCents, dailyCapCents, remainingCents },
  };
}
