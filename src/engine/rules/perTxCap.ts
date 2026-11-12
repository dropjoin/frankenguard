import { formatUsd } from "../../shared/money.js";
import type { Reason } from "../../shared/types.js";

// Rule 3 of 4. Inclusive: exactly at the cap passes (R3.2).

export function evaluatePerTxCap(amountCents: number, perTxCapCents: number): Reason {
  if (amountCents > perTxCapCents) {
    return {
      rule: "PER_TX_CAP",
      passed: false,
      code: "PER_TX_CAP_EXCEEDED",
      message: `${formatUsd(amountCents)} exceeds the per-transaction cap of ${formatUsd(perTxCapCents)}.`,
      detail: { amountCents, perTxCapCents },
    };
  }
  return {
    rule: "PER_TX_CAP",
    passed: true,
    code: "WITHIN_PER_TX_CAP",
    message: `${formatUsd(amountCents)} is within the per-transaction cap of ${formatUsd(perTxCapCents)}.`,
    detail: { amountCents, perTxCapCents },
  };
}
