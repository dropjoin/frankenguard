import type { Reason } from "../../shared/types.js";

// Rule 2 of 4. Exact match on the normalized key only: no prefixes, no
// substrings, no case-insensitive matching (R4.4). An empty allowlist
// matches nothing, so a sandbox with no recipients blocks everything.

export function evaluateAllowlist(recipientKey: string, allowlist: readonly string[]): Reason {
  const allowed = allowlist.includes(recipientKey);
  if (allowed) {
    return {
      rule: "ALLOWLIST",
      passed: true,
      code: "RECIPIENT_ALLOWED",
      message: `"${recipientKey}" is on the recipient allowlist.`,
      detail: { recipientKey, allowlistSize: allowlist.length },
    };
  }
  return {
    rule: "ALLOWLIST",
    passed: false,
    code: "RECIPIENT_NOT_ALLOWED",
    message: `"${recipientKey}" is not on the recipient allowlist.`,
    detail: { recipientKey, allowlistSize: allowlist.length },
  };
}
