# Design: Frankenguard

## Architecture

```
  typed instruction ──► parser.js ──► proposal {payee, cents, currency, memo, ref}
                                              │
  policy {txCap, dailyCap, allowlist, frozen} │
  ledger state (accepted spend per UTC day)   ▼
                                    engine.js ──► verdict {decision, reason, trace[]}
                                              │
                                    ledger.js ──► hash-chained entry (append-only)
                                              │
                                    app.js renders verdict card + ledger + stats
```

One direction, no cycles. The engine is a pure function of
`(proposal, policy, spentToday)`. The UI holds no decision logic.

## Module contracts

### parser.js — `parseIntent(text, allowlist)`

Returns `{ ok, proposal?, problems[] }`. `problems` names each field that
failed and why. Matching rules:

- Amount: find the first currency-prefixed or bare number that parses
  under the strict amount grammar: optional `$`, digits with optional
  single grouping commas, optional `.` plus one or two digits. Anything
  else (exponents, Unicode digits, three decimals, `1.234,56`) is a
  problem, not a guess.
- Payee: prefer an explicit `to <Name>` / `pay <Name>` span; fall back to
  matching any allowlisted name appearing in the text (case-insensitive).
  If neither matches, payee is `null` and the proposal is still returned
  so the engine can reject it with `PAYEE_NOT_ALLOWLISTED` rather than
  the parser inventing a payee.
- Memo: the full instruction text minus the extracted amount/payee spans
  is kept as memo context for the guardrail scan; the raw text is always
  scanned too, so hiding an injection in the payee span cannot dodge it.
- Invoice ref: `INV-` + alphanumerics, when present.

### engine.js — `evaluate(proposal, policy, spentTodayCents)`

Returns `{ decision: "PASS" | "REJECT", reason, trace }`. `trace` is an
array of `{ gate, passed, detail }` in fixed order. Gate semantics:

1. `freeze`: reject when `policy.frozen`.
2. `amount`: reject when cents is not a safe integer, <= 0, or above the
   sanity ceiling. This gate also catches malformed proposals.
3. `txCap`: reject when cents > policy.txCapCents.
4. `dailyCap`: reject when spentTodayCents + cents > policy.dailyCapCents.
5. `allowlist`: reject when normalized payee is not in the normalized
   allowlist set. Empty never matches.
6. `memo`: reject when the normalized memo (Unicode whitespace folded to
   ASCII space, case folded, zero-width characters stripped) matches any
   injection pattern: `ignore (all|any|the|previous|prior|above)`,
   `disregard`, `override`, `bypass`, `you are now`, `new instructions`,
   `do not (follow|apply|enforce)`, `jailbreak`, `system prompt`.

Determinism property: same inputs always produce the same verdict. The
test suite asserts this by evaluating every fixture twice.

### ledger.js — `createLedger(hashFn)`, `append`, `verify`

- Entry: `{ seq, ts, kind, payload, prev, hash }`. `hash` =
  SHA-256 hex of `JSON.stringify({seq, ts, kind, payload, prev})`.
- `append` is async (WebCrypto in the browser). `verify` recomputes the
  full chain and returns `{ ok, firstBadSeq? }`.
- Persistence is the app's job (localStorage, key `frankenguard.v1`).
  The ledger module only knows entries and hashes.

### MCP server — `tools/mcp-server/index.js`

Stdio JSON-RPC 2.0. Methods: `initialize`, `tools/list`, `tools/call`.
Tools: `evaluate_proposal` (same engine, policy passed by the caller),
`get_policy` (returns the default policy document), `audit_tail`
(returns the last N entries of a caller-supplied chain for verification).
No network, no secrets, stdlib only. A smoke test spawns it and asserts
a full round trip.

## UI structure (app/index.html + app/app.js)

- Hero: display headline, live stat strip computed from ledger state.
- Console: intent composer (textarea + example chips + rogue simulator),
  verdict card with gate trace, policy panel, ledger table with verify
  and export.
- Anatomy section: the stitched-parts story, one card per part.
- Honesty block: no real money, fictional vendors, deterministic parser,
  UTC-midnight edge.
- `?shot=1` mode: disables animation and forces reveals visible, for
  deterministic screenshots.

## Correctness properties (enforced by invariants.test.js)

- P1: PASS implies every gate passed.
- P2: Accepted spend per UTC day never exceeds the daily cap.
- P3: Verification detects any single-entry tampering (fuzzed).
- P4: Parser never outputs a float amount; output cents are always safe
  integers or the parse fails.
- P5: Freeze rejects everything, regardless of other inputs (fuzzed).
