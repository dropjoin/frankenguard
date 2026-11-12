import type { Reason } from "../../shared/types.js";

// Rule 1 of 4, evaluated first so the most important blocker tops the
// reasons list. Order does not change the outcome: every rule always
// runs (R2.6).

export function evaluateFreeze(frozen: boolean): Reason {
  if (frozen) {
    return {
      rule: "FREEZE",
      passed: false,
      code: "SYSTEM_FROZEN",
      message: "System is frozen. All payments are blocked.",
      detail: { frozen: true },
    };
  }
  return {
    rule: "FREEZE",
    passed: true,
    code: "NOT_FROZEN",
    message: "System is not frozen.",
    detail: { frozen: false },
  };
}
