import type { ReasonCode, RuleName } from "../shared/types.js";

// The only engine surface the browser bundle may import: display
// metadata for the four rules and their reason codes. Decision logic
// stays server-side; the client never evaluates, it only renders what
// the server decided. Rule order here must match RULE_ORDER in
// shared/types.ts, which the combiner uses.

export const RULE_LABELS: Record<RuleName, string> = {
  FREEZE: "Freeze switch",
  ALLOWLIST: "Recipient allowlist",
  PER_TX_CAP: "Per-transaction cap",
  DAILY_CAP: "Daily cap",
};

export const RULE_DESCRIPTIONS: Record<RuleName, string> = {
  FREEZE: "The emergency stop. When it is on, every payment is blocked.",
  ALLOWLIST: "Only pre-approved recipients can be paid.",
  PER_TX_CAP: "No single payment may exceed the per-transaction cap.",
  DAILY_CAP: "Total spending per UTC day may not exceed the daily cap.",
};

export const REASON_CODE_LABELS: Record<ReasonCode, string> = {
  SYSTEM_FROZEN: "System frozen",
  NOT_FROZEN: "Not frozen",
  RECIPIENT_ALLOWED: "Recipient allowed",
  RECIPIENT_NOT_ALLOWED: "Recipient not allowed",
  WITHIN_PER_TX_CAP: "Within per-transaction cap",
  PER_TX_CAP_EXCEEDED: "Per-transaction cap exceeded",
  WITHIN_DAILY_CAP: "Within daily cap",
  DAILY_CAP_EXCEEDED: "Daily cap exceeded",
  INVALID_PROPOSAL: "Invalid proposal",
  ENGINE_ERROR: "Engine error",
};
