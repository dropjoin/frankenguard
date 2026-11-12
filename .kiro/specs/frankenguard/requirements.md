# Requirements: Frankenguard (EARS)

## 1. Proposal intake

- R1. WHEN a user submits a natural-language payment instruction, THE
  parser SHALL extract payee, amount, currency, memo, and invoice
  reference, OR report the specific field it could not determine.
- R2. WHEN the instruction contains no recognizable amount, THE parser
  SHALL return an unparseable result naming the missing field instead of
  guessing an amount.
- R3. WHEN the instruction names a payee that matches an allowlisted
  vendor by case-insensitive trimmed name, THE parser SHALL resolve it to
  that vendor's canonical name.

## 2. Amount handling

- R4. WHEN an amount is parsed, THE parser SHALL represent it as integer
  minor units (cents) and SHALL reject non-finite values, zero, negatives,
  more than two decimal places, scientific notation, non-ASCII digits, and
  amounts above $10,000,000, naming the violated rule.
- R5. WHEN an amount is displayed, THE app SHALL format it from integer
  cents by integer division only.

## 3. Rule engine gates

- R6. WHEN the freeze switch is on, THE engine SHALL reject every proposal
  with reason `FROZEN` before evaluating any other gate.
- R7. WHEN a proposal amount exceeds the per-transaction cap, THE engine
  SHALL reject it with reason `OVER_TX_CAP`.
- R8. WHEN a proposal would push same-UTC-day accepted spend above the
  daily cap, THE engine SHALL reject it with reason `OVER_DAILY_CAP`.
- R9. WHEN a payee is not on the allowlist (exact match after trimming and
  case folding), THE engine SHALL reject the proposal with reason
  `PAYEE_NOT_ALLOWLISTED`. An empty payee SHALL never match.
- R10. WHEN a memo contains an instruction-injection pattern (including
  patterns hidden with Unicode whitespace or mixed case), THE engine SHALL
  reject the proposal with reason `MEMO_GUARDRAIL`.
- R11. WHEN a proposal is malformed (missing fields, wrong types), THE
  engine SHALL reject it with reason `PROPOSAL_MALFORMED` or
  `AMOUNT_INVALID` without throwing.
- R12. WHEN a proposal passes all gates, THE engine SHALL approve it with
  reason `PASS` and record the spend against the daily ledger.

## 4. Verdict trace

- R13. WHEN a verdict is produced, THE engine SHALL return the result of
  every gate in fixed order (freeze, amount validity, per-tx cap, daily
  cap, allowlist, memo guardrail), including gates that passed.
- R14. THE verdict trace SHALL be rendered in the UI so a judge can see
  exactly which gate fired and why, with no gate hidden.

## 5. Audit ledger

- R15. WHEN a verdict is produced or the policy changes, THE app SHALL
  append an entry to the hash-chained ledger before rendering the result.
- R16. WHEN the chain is verified, THE ledger SHALL recompute every hash
  and report the first entry whose stored hash does not match, or confirm
  the chain is intact.
- R17. WHEN any stored entry is modified after the fact, THE verification
  SHALL detect it.
- R18. THE ledger SHALL support export as JSON and as CSV.

## 6. Policy management

- R19. THE user SHALL be able to change the per-transaction cap, the daily
  cap, the allowlist, and the freeze switch from the UI.
- R20. WHEN the policy changes, THE app SHALL append a policy-change entry
  to the ledger recording the old and new values.
- R21. THE default policy SHALL be per-tx $250, daily $500, allowlist of
  four fictional demo vendors, freeze off.

## 7. Rogue-agent simulator

- R22. WHEN the user releases the rogue-agent simulator, THE app SHALL
  fire a fixed scripted sequence of adversarial proposals (over-cap,
  injection memo, unknown payee, frozen-state attempt, amount trick,
  duplicate) and evaluate each through the real engine.
- R23. THE simulator SHALL use the same code path as a typed proposal. No
  separate "demo verdict" logic is permitted.

## 8. Honesty and limits

- R24. THE page SHALL state that no real money moves, no wallet is
  connected, and the default vendors are fictional demo data.
- R25. THE page SHALL state that the intent parser is deterministic, not
  an LLM, and that the rule engine makes every decision without a model.
- R26. THE page SHALL document the UTC-midnight daily-cap edge case.

## 9. Kiro evidence

- R27. THE repo SHALL contain `/.kiro` at root with steering docs, this
  spec (requirements, design, tasks), agent hook configs, an MCP server
  config, and a custom agent definition.
- R28. THE repo SHALL contain a working MCP server (stdio JSON-RPC) that
  exposes the engine's evaluation over tools, covered by a smoke test.
- R29. THE repo SHALL contain a dated build journal recording decisions,
  real friction, and what tests caught.
