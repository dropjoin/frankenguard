# Build journal: Frankenguard

Dated notes from the build. Decisions, friction, and what the tests
caught. Written as I went, not reconstructed afterwards.

## 2026-11-12: spec before code

I wrote the spec before touching implementation, and it paid for itself
within the hour. The EARS requirements forced a decision I would have
dodged otherwise: what happens when the parser cannot determine a field?
The answer that survived into the code is that the parser reports the
specific missing field and never guesses, and an unresolved payee stays
null so the engine rejects it with `PAYEE_NOT_ALLOWLISTED` instead of the
parser inventing a recipient. That one decision shaped both modules.

The design doc's five correctness properties became `invariants.test.js`
almost verbatim. Writing P2 ("accepted spend per UTC day never exceeds
the daily cap") before the engine existed meant the engine was written to
satisfy a check, not to look right.

## 2026-11-12: integer cents, no exceptions

The first argument I had with myself was about floats. Every money bug I
have ever seen started with someone doing arithmetic on decimals, so the
rule went into the steering docs before any code: amounts are integer
minor units from the moment they are parsed, and display formatting is
the only place decimals reappear, via integer division. The parser
converts with BigInt so a 20-digit amount fails the sanity ceiling
instead of silently losing precision. `formatCents` is ten lines and has
its own test. Boring on purpose.

## 2026-11-12: the amount grammar fights back

The parser was supposed to be the easy part. It was not.

First, invoice numbers: `Pay invoice INV-1042` must never become a $1,042
payment. The fix is to extract and strip invoice refs before amount
scanning, and there is a test named after exactly that trap.

Second, the test suite caught a real bug on its first run: lowercase
`inv-abc-9` did not match the invoice regex because I forgot the `i`
flag. One character, one failing test, fixed in a minute. This is why
the parser has 11 tests for a 150-line module.

Third, amount tricks: `1e3`, `1.234`, `1,2,3`, `1.234,56`, Arabic-Indic
digits, and a bare `8812` in "refund for order 8812" all had to fail
loudly with a named rule instead of parsing into something plausible.
The strict grammar in `parseAmountString` rejects all of them, and the
full-instruction tests assert the rejections end to end.

## 2026-11-12: the trace must not lie

My first engine draft marked the per-tx and daily-cap gates as *failed*
when the amount itself was invalid, with a detail saying "skipped". The
trace would have shown three red gates for one bad amount. I changed
skipped gates to `passed: null` and made the verdict reason come from the
first gate with `passed === false`. A skipped gate never decides a
verdict, and the trace now tells the truth: one failure, two skips, three
passes. Small thing, but the trace is the product: a judge who cannot
trust the trace cannot trust the verdict.

## 2026-11-12: the build script's `$` trap

The build inlines source files into one HTML file with `String.replace`.
The first build produced a file that still contained a `<script src>`
tag, and the verifier caught it. The cause: `String.replace` interprets
`$'` and `$&` in the replacement string, and the engine source contains
`$` sequences. The fix is a replacer function, which disables the pattern
interpretation. I left a comment in `build.mjs` because this is exactly
the kind of bug that gets reintroduced by someone "simplifying" the code.
The build is verified deterministic: two runs produce identical SHA-256.

## 2026-11-12: jsdom has no WebCrypto, and that was useful

The DOM smoke test (committed as `tests/dom-smoke.cjs`, needs jsdom
installed separately since the app itself is zero-dependency) crashed on
the first run: `crypto.subtle` is undefined in jsdom, and the boot
self-check threw an unhandled rejection. In a real browser on https this never happens,
but the crash exposed a real gap: a missing subtle would have killed the
page silently. I added a fail-visible guard at boot that explains the
page needs a secure context and disables the proposal buttons. The smoke
test then passed all ten scenarios, including tamper detection at the
exact entry. The guard will probably never fire in production. I kept it
anyway: fail-visible beats fail-silent every time.

## 2026-11-12: the UTC-midnight edge stays documented

A calendar-day daily cap has a known hole: spend the full cap at 23:59
UTC and again at 00:01 UTC. I considered a rolling 24-hour window and
rejected it: nobody, including me, can look at a rolling window and say
with confidence how much headroom is left. The calendar day is simple,
inspectable, and its edge is stated on the page, in the README, and in
the spec. Documented edges are features; hidden ones are bugs.

## 2026-11-12: design tokens, not adjectives

The page was briefed from the project's own design playbook, not from
words like "premium". The hero, meter card, marquee, stats band, and
reveal motion copy measured patterns from approved work (giant display
type at 6-8x body size, tracked uppercase labels, 16px reveals, `?shot=1`
screenshot mode). The palette is theme-chosen, not default black: deep
violet night for Kiro's brand and Halloween, pumpkin orange used
sparingly, Frankenstein green reserved for PASS verdicts. Typography is
Bricolage Grotesque for display, Inter for body, IBM Plex Mono for data:
a deliberate rotation, because every project defaulting to the same two
fonts is how entries start looking interchangeable.

## 2026-11-12: the boot self-check

An empty stats band looks dead, and fake stats are a lie I refuse to
ship. The compromise: on first run, the app evaluates three canned
proposals through the real engine and appends them as ledger entries
labeled `self-check`. The numbers on the page are then real computed
values from real evaluations, the ledger is never empty, and the
self-check PASS does not consume daily budget (only `verdict` entries
count toward spend). It is the app proving itself on load, with the
labeling to prove it is not faking.

## 2026-11-12: what the field looks like

Competitor scan (full notes in `docs/competitor-scan.md`): GhostPR welds
screen recordings to Playwright repros and PRs; CodeVault already ships
a SHA-256 audit chain, so the chain alone is not a differentiator; the
Signal Box entry set the Kiro-evidence bar with EARS specs and property
tests. What Frankenguard has that they do not: a live decision loop a
judge can attack in under a minute, a verdict trace that shows every
gate, and a rogue-agent simulator that runs the attacks through the same
code path as a typed proposal. If the demo does not survive a judge
trying to break it, nothing else matters. That is why the smoke test
exercises the shipped file, not a sketch of it.

## 2026-11-12: shipped

Live at https://frankenguard.apeagent.online, byte-identical to
`dist/index.html` (SHA-256 verified after deploy). 40 tests green. No
secrets in the tree (the verifier scans before every push). The demo
video and the Devpost submission are still to come; the submission draft
is in `docs/devpost-draft.md`.

---

## 2026-11-13: the Kiro specs arrive, and the pre-STOP build goes

The Kiro Web spec session produced the real spec stack, now in
`.kiro/specs/frankenguard/` (requirements.md, design.md, tasks.md, plus
RETRIEVAL-NOTES.md marking the passages the retrieval could not verify).
The spec stack is authoritative. The pre-STOP code I wrote on 2026-11-12
was built from my own short drafts, and in several places it contradicts
the Kiro spec outright. I assessed every file against the spec before
touching anything. The snapshot commit 9844818 preserves the old build
exactly; nothing below is lost, it is superseded.

### Keep / port / rebuild decisions

**Rebuild: `src/engine.js` → TypeScript engine per design §2.4.** The
old engine has six gates; the spec has exactly four rules in fixed
order, one Reason each, always all four evaluated. Worse, the old
engine's memo guardrail gate REJECTS on injection patterns, which
directly violates R1.10/R2.10/R7.19: the decision must never depend on
memo text, and the prompt-injection scenario must fail on the allowlist
and per-tx cap, not on what the memo says. Reason codes, verdict names,
default caps ($250/$500 vs the spec's $500/$1,000), and the skipped-gate
`null` all differ too. Ported forward: the integer-cents formatting
approach, and the normalization rigor (zero-width and exotic-whitespace
handling), adapted to the spec's NFKC + lowercase + trim + 1-64 rule.

**Rebuild: `src/ledger.js` → SQLite-backed hash chain.** The old chain
is in-memory, 0-based, genesis `FRANKENGUARD-GENESIS`, fixed-order
`JSON.stringify`, async injected hashing. The spec wants better-sqlite3,
AUTOINCREMENT seq, 64-zero genesis prev_hash, sorted-key canonical JSON
that rejects floats, sync SHA-256, and integrity triggers. Ported
forward: the fail-fast verify loop shape (`brokenAtSeq`).

**Drop as a module, port the grammar: `src/parser.js`.** The spec has no
intent parser: the live agent returns structured JSON validated by Zod,
and the manual form takes typed inputs. But the strict BigInt
decimal-to-cents grammar is good work with real edge-case tests, and
task 7.2 needs float-free dollar conversion in the form. It survives as
`shared/money.ts` `parseDecimalToCents`. The payee-resolution and
invoice-ref machinery has no spec consumer and goes.

**Remove: `tools/mcp-server/`, `.kiro/settings/mcp.json`,
`tests/mcp.test.js`.** No MCP component exists in the Kiro architecture,
and the server wraps the old six-gate engine, so it would report reason
codes the spec does not define. The reviewer agent doc is rewritten to
match (it keeps the skeptical posture, loses the dead tool references).

**Remove and rebuild: `app/`, `dist/`, `scripts/`.** The old console UI
is vanilla JS, dark-themed, and localStorage-based. The spec requires
React 18 + Vite + TypeScript, a binding LIGHT-ONLY theme, and a
server-side SQLite audit trail served by Fastify. The old UI's copy
also describes six gates. Ported forward: the `?shot=1` deterministic
screenshot idea (as a Playwright screenshot script with reduced-motion
emulation), and the `verify.mjs` static-check ideas (title rule, secret
scan, honesty labels) as Vitest guard tests. `deploy.py` (Cloudflare
Worker, static file) is superseded by the Dockerfile in task 8.4.

**Rebuild: `tests/` in Vitest.** The node:test suites test the old
modules. Test CASES survive where the spec agrees (boundary values,
Unicode traps, UTC-midnight edges); memo-guardrail and parser tests are
rewritten, because prompt injection must now assert memo independence.

**Rewrite: `.kiro/steering/*.md`.** The old steering contradicts the
spec on stack (vanilla vs TypeScript/Fastify), gates (six vs four),
reason codes, ledger (localStorage vs SQLite), and theme (dark violet
night vs light-only). The product metaphor and the non-negotiables that
still hold (deterministic, fail closed, no real money, integer cents)
stay.

**Keep: `docs/research.md`, `docs/competitor-scan.md`,
`docs/color-study.md`, `LICENSE`.** Background and license; the
competitor scan still sets the bar (CodeVault already ships a SHA-256
chain; the differentiator is the live decision loop a judge can attack).

**Rewrite in Phase 8.5: `README.md`, `docs/devpost-draft.md`.** Both
describe the old six-gate app. Identity in both is already correct
(dropjoin / M Aziz Yahya / dropjoin0@gmail.com); the repo-wide scan
found no other account or email anywhere.

### Derivations from truncated spec passages

RETRIEVAL-NOTES.md marks what the retrieval could not verify. Each gap
is filled from requirements.md (complete) plus the design prose, and
logged here as a derivation, never as Kiro-verbatim. The running list
lives in the "Derivations" section at the end of this journal; every
entry names the gap, the sources used, and the choice made.

## Derivations

Numbered, in the order the gaps were hit. "Gap" names the truncated
passage; "choice" is what the code does; nothing here is Kiro-verbatim.

- **D1 — per-tx pass code.** Gap: design §3.2 reason-code table rows
  truncated; only WITHIN_DAILY_CAP was captured for the daily pass.
  Choice: `WITHIN_PER_TX_CAP`, by symmetry with `WITHIN_DAILY_CAP`.
- **D2 — decision-level reasons.** Gap: how INVALID_PROPOSAL and
  ENGINE_ERROR fit a Decision whose reasons are one-per-rule. Choice:
  those two paths return zero reasons (no rule ran, R1.3/R2.8) and the
  code travels in the top-level `reason` field, which otherwise holds
  the first failing rule's code, or `"APPROVED"` when all pass.
- **D3 — unreadable config.** Conflict, not a gap: R2.8 says
  ENGINE_ERROR for unreadable configuration, R5.8 says SYSTEM_FROZEN
  when the frozen state cannot be determined, design §4.6 and task 3.3
  say ENGINE_ERROR. Choice: ENGINE_ERROR with frozen behavior (outcome
  REJECTED, nothing executes). The behavior honors R5.8; the code
  honors R2.8 and the design/task text.
- **D4 — ENGINE_ERROR snapshot.** Gap: what `snapshot_json` holds when
  no snapshot could be read. Choice: JSON null, and the API returns
  `snapshot: null` for those decisions.
- **D5 — invalid proposal persistence.** Gap: design §4.7 persists the
  proposal before validation, but task 3.1 allows exactly one audit row
  and no decision/payment for invalid proposals, while R1.3 requires
  the rejection in the audit trail. Choice: persist the proposal row
  with best-effort coerced fields (status BLOCKED), write exactly one
  PROPOSAL_RECEIVED row whose payload carries the full raw payload plus
  the validation outcome, and write no decision or payment row.
- **D6 — request_hash input.** Gap: "canonical proposal JSON" is not
  spelled out. Choice: SHA-256 of canonical JSON of the raw input
  fields `{recipient, amountCents, currency, memo}` as received, so
  "same body" means byte-equal input.
- **D7 — 422 vs INVALID_PROPOSAL.** Gap: design §6.4 maps validation
  failure to 422 while R1.3 records shape-invalid proposals with 200.
  Choice: a body that is not a JSON object at all gets 422
  INVALID_INPUT (nothing can be recorded); anything object-shaped goes
  to the engine, which classifies it, and failures are recorded as
  INVALID_PROPOSAL with 200. Task 1.1's test list puts type errors in
  the engine, which settles the split.
- **D8 — seq contiguity.** Gap: design §3.3 says seq has no gaps
  "within a sandbox" while §3.1 defines a global AUTOINCREMENT. Choice:
  global seq as defined; no seq-contiguity trigger, because
  AUTOINCREMENT's high-water mark plus purging makes strict global
  contiguity unenforceable. The chain-link trigger (prev_hash must
  equal the sandbox tail) is the real guarantee, and verifyChain checks
  strictly increasing seqs plus hash links.
- **D9 — config-change audit types.** Gap: design §3.1 lists
  CONFIG_CHANGED while §3.4 calls CAPS_CHANGED / ALLOWLIST_CHANGED /
  FREEZE_CHANGED "kinds of CONFIG_CHANGED", and R3.9/R4.6/R5.5 name
  them as entry types. Choice: store the specific name as the audit
  `type` (requirements language wins; the column has no CHECK).
- **D10 — AUDIT_VERIFIED.** Gap: the type exists in §3.1 but no flow
  writes it, and task 5.6 makes the audit routes read-only. Choice:
  the verify endpoint never writes; the type stays in the vocabulary
  unused.
- **D11 — seed labels.** Gap: design §7 allowlist labels truncated.
  Choice: "Acme Corp" (the name §5.2's scenarios use for acme-corp),
  "Globex Corp", "Initech" (same key-to-label pattern).
- **D12 — purge flag storage.** Finding, not a gap: SQLite forbids
  triggers in the main database from referencing temp tables, so the
  planned temp-table flag failed at migration time with a hard error.
  Choice: a one-row `purge_mode` table in the main schema, reset to 0
  by openDb on every open, written only by the purge path inside a
  finally-guarded helper.
- **D13 — EXPIRING state.** Gap: the state CHECK lists EXPIRING but no
  passage defines when a sandbox is EXPIRING. Choice: never written;
  sandboxes are ACTIVE until purged.
- **D14 — snapshot identity.** Gap: `snapshotKey` and `payloadVersion`
  are named but never defined. Choice: payloadVersion `"1"`;
  snapshotKey is the SHA-256 of the canonical JSON of the snapshot's
  other fields; the allowlist is stored sorted so equal policies hash
  equal.
- **D15 — proposal label.** Gap: ValidProposal carries an optional
  label but no input field supplies it. Choice: the service resolves
  it from the allowlist entry at submit time; a caller-supplied label
  is never trusted (R4.3).
- **D16 — remainingCents.** Gap: design §4.3 requires remainingCents
  in the daily-cap detail without saying before or after. Choice:
  headroom BEFORE the proposal, the same number the spend meter shows.
- **D17 — clientOnly.ts.** Gap: design §2.4 lists the file; no passage
  defines it. Choice: the browser-safe display-metadata surface (rule
  labels, descriptions, reason-code labels). Decision logic is never
  re-exported to the client.
- **D18 — repositories and transaction helper.** Gap: design §2.4
  names only schema.sql and migrate.ts under db/, while task 2.4
  requires typed repos and §4.7 requires BEGIN IMMEDIATE. Choice:
  `db/repositories.ts` and the `withImmediateTransaction` helper in
  `db/migrate.ts`.
- **D19 — clock clamping.** Gap: design §12 says the clock is "clamped
  to be non-decreasing within a sandbox" without a mechanism. Choice:
  effective now is max(server clock, sandbox last_seen_at), applied in
  touchSandbox.
- **D20 — amount zero.** Conflict: design §4.3 writes "integer
  0–1,000,000,000, inclusive" while R1.2 requires a positive integer
  and task 1.1 lists amount 0 as an invalid case. Choice: 0 is
  rejected (requirements + task list win).
- **D21 — memo length.** Gap: "≤ 280 chars" without a counting rule.
  Choice: Unicode code points, after trimming.
- **D22 — empty idempotency key.** Gap: no passage covers a present
  but empty key. Choice: field error; omit the field to skip
  idempotency.
- **D32 — audit-limit enforcement.** Gap: the 2,000-entry limit without
  an enforcement point. Choice: refuse a submit when
  auditCount + 3 > 2000 (a submit writes up to 3 entries), so the log
  can never cross the limit; a submit starting at 1,997 lands exactly
  at 2,000.
- **D33 — removing an unlisted recipient.** Gap: no passage defines
  the outcome. Choice: 404 NotFoundError, explicit feedback over
  silent idempotent success; the UI always shows the current list.
- **D34 — audit payload shapes.** Gap: design §6.1 names the fields
  each audit type must carry but not the exact JSON. Choice:
  PROPOSAL_RECEIVED carries recipientKey/amountCents/currency/memo/
  idempotencyKey, plus invalid/fields/outcome/reason on the invalid
  path; DECISION_MADE carries outcome/reason/reasons/snapshot/
  dailySpentCents/windowStart (snapshot null + errorKind on
  ENGINE_ERROR); PAYMENT_EXECUTED carries paymentId/amountCents/
  recipientKey; config changes carry previous/new (and change for
  allowlist). The query filters in queries.ts are the contract.
- **D35 — replay before limits.** Gap: no ordering given. Choice: the
  idempotency lookup runs before the limit checks, so a replay at the
  limit still returns the original decision without writing anything.
- **D36 — request-hash stringify.** Refinement of D6: the hash uses a
  lenient sorted-key stringify (floats and odd values stringify
  deterministically) rather than canonicalJson, so a malformed body
  still hashes deterministically and replays compare correctly.

## Phase 3 — services (13 Nov 2026)

ProposalService.submit in one BEGIN IMMEDIATE transaction, in the
design 4.7 order, with one deliberate swap: validation runs before
the persist, because an invalid proposal's single audit row must
carry the validation outcome. The persisted state is identical
either way (all-or-nothing transaction). Fail-closed via a
test-only fault seam: config/allowlist/ledger failures record
ENGINE_ERROR; a failing DECISION_MADE write rolls everything back
and surfaces 503. ConfigService validates with Zod outside the
transaction, bumps config_version, audits every change. Audit
queries are plain SQL over the JSON payloads with cursor
pagination. 200 randomized submits across 4 connections never push
executed spend past the daily cap and leave the chain valid.
150 tests green (110 before).
- **D27 — over_daily sizing.** Conflict: design §5.2 says "2x $600"
  but $600 exceeds the $500 per-tx cap, so those proposals would fail
  PER_TX_CAP before the daily cap ever saw them. Choice: fills of
  min(perTxCap, remaining headroom), at most 50, then one probe of
  min(perTxCap, remaining + 1) — $1 when the cap is exactly filled.
  Under default caps that is 2 fills + probe. With daily > 50x
  per-tx no single probe can fail the daily cap; the probe still
  goes out and the honest verdict is shown.
- **D28 — live provider.** Gap: design §5.3 names no provider API.
  Choice: an OpenAI-compatible chat-completions endpoint, with
  AGENT_MODEL and AGENT_BASE_URL as optional overrides, one isolated
  fetch function taking an injected fetch for tests.
- **D37 — agent orchestration.** Gap: design §2.4 names only
  types/scripted/live under agents/, but something must turn a run
  into submitted proposals. Choice: `src/agents/run.ts` holds the
  orchestration (scenario dispatch, live call, fallback, submit
  loop).
- **D38 — bare prompts.** Gap: no passage covers a prompt-only run
  with the live agent off. Choice: refused with InvalidInputError
  rather than silently reinterpreted; a live failure falls back to
  the happy_path scenario and reports agentMode
  "scripted_fallback".
- **D39 — fixed scenario amounts.** Choice: the other five scenarios
  use the design's fixed amounts verbatim; only over_daily adapts
  to the current config. Under changed caps the same proposals get
  different verdicts, which is what the demo is for.

## Phase 4 — agents (13 Nov 2026)

Six scripted scenarios, the env-gated live agent (one LLM call,
Zod-validated, 10s timeout, never told caps or verdicts), and the
run orchestration that submits everything through ProposalService
with server-generated idempotency keys. A hostile agent returning
extra fields (approved: true, a forged snapshot) cannot change a
verdict: validation builds a fresh proposal from known fields
only. 178 tests green (150 before). Live agent stays disabled by
default; no keys anywhere in this repo.
- **D23 — cookie Secure flag.** Gap: design §6.5 says Secure "in
  production" without a mechanism. Choice: Secure is on exactly
  when NODE_ENV=production, off for local HTTP development.
- **D24 — error envelope.** Gap: design §6.4 names codes and statuses
  but not the JSON shape. Choice: `{error: {code, message}}` for
  every error, including framework errors and the 404 handler;
  RateLimitedError adds a Retry-After header.
- **D29 — live rate bucket.** Gap: the 6/min live bucket would
  throttle scenario clicking in live mode. Choice: it gates only
  prompt runs while the live agent is enabled; scenario runs always
  use the normal 30/min write bucket.
- **D30 — entrypoint.** Gap: design §2.4 names the factory
  (server.ts) but no entrypoint. Choice: `src/api/main.ts` reads
  env, opens the DB, starts the sweeper, and listens. Live mode
  without AGENT_API_KEY fails startup loudly.
- **D31 — healthz.** Gap: no response shape given. Choice: JSON
  `{status: "ok"}`, unthrottled, no cookie required.
- **D40 — framework error mapping.** Gap: Fastify's own errors have
  no design mapping. Choice: malformed JSON → 422 INVALID_INPUT
  (Fastify 5 code FST_ERR_CTP_INVALID_JSON_BODY), oversize body →
  413 PAYLOAD_TOO_LARGE, other 4xx → INVALID_INPUT with the
  framework status, anything else → 500 INTERNAL_ERROR with no
  internals leaked.
- **D41 — sandbox responses.** Gap: no body shape given. Choice:
  POST /api/sandbox returns `{sandboxId}` (201 new, 200 live
  cookie); POST /api/sandbox/reset returns `{sandboxId}` with 200
  and the new cookie.
- **D42 — recent proposals.** Gap: StateResponse carries
  recentProposals without a count. Choice: the 10 most recent.
- **D43 — published contrast ratios.** Gap: the ratios printed in
  design §8.4.1 do not reproduce exactly under the standard WCAG
  relative-luminance formula (e.g. text-body on base-gray computes
  13.11:1, not the published 15.00:1; brand on gray 6.55 vs 6.85;
  success on gray 6.37 vs 6.06). Choice: the 4.5:1 threshold is
  binding and is enforced by computation in the theme tests; the
  published decimals are treated as approximations and are never
  asserted. Every pair still passes the threshold — the worst is
  brand-alt on lavender at 4.56.
- **D44 — type scale sizes.** Gap: design §8.4.1 fixes only
  --text-base (1rem) and the line-heights/tracking; display sizes
  are not specified. Choice: display-1 clamp(2.5rem, 6vw, 4rem),
  display-2 clamp(1.75rem, 4vw, 2.5rem), display-3
  clamp(1.25rem, 2.5vw, 1.5rem), small 0.875rem, label 0.75rem.
  Fluid clamps keep 375px headings inside the viewport without a
  separate mobile scale.
- **D45 — live prompt box.** Gap: task 7.2 names an "optional live
  prompt box" without saying when it appears. Choice: shown only
  when the server reports agentMode live; in scripted mode the
  panel says plainly that the live agent is disabled, instead of
  showing a dead input.
- **D46 — "Agent proposal" badge.** Gap: ProposalResponse carries
  no actor, so the client cannot tell agent proposals from manual
  ones from state alone. Choice: the App tracks the proposal ids
  returned by the most recent agent run in this session and badges
  those cards; a manual submission clears the set.
- **D47 — verified ghost.** Gap: the ghost has a verified state
  but no specified lifetime. Choice: it shows after a successful
  chain verification and lasts until the next audit entry lands
  (tracked through the audit head count), then the ghost goes
  back to reacting to verdicts.
- **D48 — retry-after.** Gap: the 429 notice needs a wait time the
  error envelope does not carry. Choice: ApiError parses the
  Retry-After response header into retryAfterSeconds (null when
  absent); the notice shows the wait only when the server sent one.
- **D49 — scenario labels.** Gap: design §5.2 fixes the scenario
  amounts and outcomes but no button copy. Choice: labels and one
  -line descriptions derived from the §5.2 prose, using the fixed
  amounts where the design states them ($100 happy path, $750
  over-per-tx, $100 frozen, $5,000 injection).
- **D50 — INVALID_PROPOSAL field messages.** Gap: the proposal
  response carries no field-level detail, but task 7.2 wants
  field messages. Choice: field-level messages come from
  client-side validation that mirrors the engine grammar
  (recipient shape, the strict decimal parser, memo length); a
  server INVALID_PROPOSAL renders a generic check-the-fields
  notice plus the decision-level card. The server stays
  authoritative; the client checks are UX only.
- **D51 — static serving.** Gap: the design specifies the API and
  the client but not how the built client is served. Choice: the
  server serves `dist/web` through @fastify/static when a web
  root is configured, with an SPA fallback that answers GET/HEAD
  requests for non-/api paths with index.html; /api paths and
  non-read methods always get the JSON 404 envelope, so the
  fallback can never shadow the API. `WEB_ROOT` overrides the
  root (default: `dist/web` relative to the entrypoint); a
  missing directory fails startup in production and warns +
  serves API-only otherwise.
- **D52 — tamper demo endpoint.** Gap: task 8.6 wants a broken
  chain demonstrable, but no endpoint shape. Choice: POST
  /api/_demo/tamper with `{seq}`, returning `{seq,
  tampered: true}`, registered only when TAMPER_DEMO=1, scoped
  to the caller's sandbox, reusing the purge_mode bypass so the
  append-only triggers stay the enforcement mechanism everywhere
  else. With the flag off the route does not exist.
- **D53 — depth limits.** Gap: the specs cap request size (8 KB)
  but never nesting, and neither canonicalJson nor the request
  hash stringify had a depth bound. Choice: 100 levels in both.
  canonicalJson throws its usual "not canonical JSON data"
  message past the limit, so verifyChain reports the entry
  broken instead of crashing; the request hash throws
  InvalidInputError, so an absurdly nested body answers 422
  before any write. Real bodies and payloads nest a handful of
  levels; 100 is headroom, not a behavior change.
- **D54 — unparseable audit payloads.** Gap: no passage defines
  what the audit view does with a stored payload that is not
  valid JSON (only a corrupted database can hold one). Choice:
  the entry is still listed, with an empty payload and a
  `payloadParseError` marker on the view, and the UI chips it
  Unparseable and says its contents can't be shown. Skipping
  the row would have hidden a gap in the trail; failing the
  whole view punished every other entry for one bad row.

## Phase 5 — API (13 Nov 2026)

Fastify factory with the cookie session middleware (touch on every
request, 401 on missing/unknown/expired), all thirteen routes, the
five token buckets, security headers, and the centralized error
handler. No Fastify schema validation on bodies: malformed
proposals must reach the service and be recorded. The built server
was smoke-tested live (healthz 200, state 401, sandbox 201).
213 tests green (178 before).

## Phase 6 — Frontend foundation (13 Nov 2026)

Theme tokens exactly as specified (design §8.4.1), with --stitch
decided D25 and the type scale decided D44. Contrast verified by
computation before any component shipped: all 8 text tokens pass
4.5:1 on all 3 bases, text-on-fill passes on every fill, white
passes on purple/amethyst/hero ends and FAILS on blue (3.15:1),
so white never sits on blue. Font metrics were measured from the
installed WOFF2 files with fontTools and the fallback faces carry
x-height-matched size-adjust values (Inter 103.33%, Space Grotesk
91.99%, Geist Mono 100.32%); no preload, per D26.

Art kit is hand-drawn SVG (ghost in 5 states, monster head, bolt,
suture divider, jack-o'-lantern, snowflake), all decorative and
aria-hidden, total weight under 60 KB, no raw hex in TSX sources.
Primitives: button, badge, inline message, link, status pill,
panel, chip, meter, toggle, banner — every status indicator pairs
an icon with a text label, nothing is color-only. Header band is
the hero gradient with the wordmark, tagline, frozen-aware ghost,
agent badge, and reset. App shell wires the store (first visit
creates a sandbox on 401, expired offers a fresh one) and always
renders the SIMULATED MONEY ONLY banner; the panels grid is empty
until Phase 7. Favicon is a simplified ghost SVG with raw hex,
because an external SVG cannot see CSS custom properties — the
no-hex lint rule is scoped to TSX and CSS, not the favicon.

Two test-harness facts worth recording: Vitest runs with globals
off, so Testing Library cleanup must be registered explicitly in
the setup file; and import.meta.url is unreliable under the Vite
transform (it also rewrites `new URL` asset patterns), so the
theme/art tests resolve fixture paths from process.cwd().
270 tests green (213 before).


## Phase 7 — Frontend features (13 Nov 2026)

Four panels wired to the store. Agent: six scenario buttons (the
frozen one stays disabled with a visible hint until freeze is on),
the live prompt box only in live mode (D45), and the manual form
with float-free cents conversion and client-side field checks
mirroring the engine grammar (D50). Decisions: cards newest-first
with 6px rails, four rule rows in fixed order, reason codes in
mono, the lab strip lighting its stamps in sequence, the ghost
driven by the latest outcome, expandable bundle detail, and the
aria-live announcement. "Caught by FrankenGuard!" appears only
when a rule actually caught the proposal — decision-level cards
(INVALID_PROPOSAL, ENGINE_ERROR) get the plain note instead, since
no rule ran. Controls: caps form, allowlist chips, freeze switch,
meter with the three breakpoints and captions, and the UTC reset
countdown. Audit: filters, expandable payloads in a light terminal
block, linked-entry highlighting, a support ghost every fifth
line, and the verify control with intact/broken states plus the
truncation caveat stated in the open. Frozen theming is a fixed
--blue frame wiped in over 500ms, the info banner, and the info
rail on Controls. Motion stays inside the caps (250/400/500ms)
and dies under reduced motion. Error states share one mapping:
warning banners for expired/rate-limited/limited sandboxes, error
banners for audit outages and network failures, each with a
pumpkin action button. Agent text is rendered as text everywhere;
the XSS tests prove no elements are created from hostile memos
and payloads. 338 tests green (270 before). The axe pass (7.9)
rides with the Playwright suite in Phase 8.

## Phase 8 — Hardening, screenshots, container, docs (13 Nov 2026)

Static serving (8.1): the server serves the built client with an
SPA fallback that can never shadow the API (D51), plus a smoke
script that boots the built server and checks the page and the
sandbox flow. The tamper demo (8.6) is a flag-gated endpoint
scoped to the caller's sandbox (D52). Building it caught a real
bug: the `audit_no_update` trigger had no purge-mode clause, so
every update aborted unconditionally. The fix is migration 002
(drop and recreate the trigger with the purge check), the
corrected definition in schema.sql for fresh databases, and a
migrate.ts that applies versions sequentially. Fresh databases
carry schema rows {1, 2}; a v1 database upgrades in place, proven
by test.

End to end (8.2): a serial Playwright journey (shared contexts,
because sandbox creation is budgeted), the axe pass (7.9) with no
serious or critical violations on the default, blocked, and frozen
states, and no-horizontal-scroll checks at 375/768/1280. Two
selector lessons: `getByText` is a case-insensitive substring
match, so status words need exact matching scoped to the header,
and the frozen banner text also appears in rule messages, so the
banner needs its own scope. 20 tests green on desktop + mobile.
Playwright is pinned at 1.50.1; @axe-core/playwright 4.14 wanted
a newer playwright-core, so an override pins one copy of
playwright-core 1.50.1 for the whole tree, verified both by
typecheck and by the axe tests running for real.

Visual QA (8.3): a screenshot script captures six states
(default, approved, blocked, frozen, verified, broken-chain) at
three viewports, committed for review. The first pass caught five
real defects: the monster head rendered unbound (its sizing class
was never applied), the audit filter options truncated in their
columns, the toggle thumb never moved (a flex-order trick that
left it in one place), the frozen frame was viewport-fixed and
cut across full-page captures (now page-absolute, framing the
whole page), and the snowflake icon was invisible on the info
fill. All five fixed, screenshots recaptured, snapshots updated
for the one intentional class change.

Container (8.4): a two-stage Dockerfile (node:20 builder,
node:20-slim runtime, volume for the database, /healthz
healthcheck, non-root user) plus deployment notes. No Docker
daemon exists on the build machine, so the image was not run end
to end; the doc says so plainly. What was verified instead: the
runtime stage's exact dependency set, and the built server
booting from a production-only install and serving the UI and
the sandbox flow.

Docs (8.5): README, demo walkthrough, and Devpost draft rewritten
for the shipped four-rule app; the six-gate copy is gone. The
Devpost draft keeps placeholders for the demo URL and video,
which only exist at deploy time. Verified by fresh clone: clone,
npm ci, 349 tests green, build, boot, sandbox creation, and a
happy-path approval through the real API, all from the README
commands alone.

One more fix belongs to this phase even though it surfaced in the
final verification: the audit empty-state test flaked because the
timeline refetched on every store change (its loader depended on
the whole store object, and the first getState landing detached
the empty state mid-assertion). The read-only store passthroughs
are stable callbacks now, the loader depends on listAudit only,
and the suite is green four runs in a row. Final state: 349
Vitest tests, 20 Playwright tests, typecheck and lint clean.

## Post-Phase 8 — security audit fixes (13 Nov 2026)

A read-only security audit of the shipped tree found one medium
and seven lows, no rule-engine bypass, no sandbox escape, no
chain forgery through the API. Every finding got a regression
test written to fail first, then the fix, then the auditor's own
probes re-run where they existed.

The medium was a docs/code mismatch: the deployment notes say
TRUST_PROXY=1, the code required the string "true", so a
deployment following the docs ran with proxy trust off and every
visitor sharing one rate-limit bucket. The code now accepts "1"
and "true", matching TAMPER_DEMO; env parsing moved to its own
module so the flag contract is unit-testable. The rotating
X-Forwarded-For probe confirms it: 11/11 creations, 130 reads,
zero 429s with TRUST_PROXY=1.

The lows: verifyChain reports broken instead of throwing on a
stored payload that is not canonical data, with a depth limit in
canonicalJson (D53); audit views survive one unparseable payload
by marking the entry instead of 500ing (D54); absurdly nested
request bodies answer 422 instead of stack-overflowing (D53);
the audit panel and the Devpost draft now say only what is true
about editing and about where validation lives; the purge flag
only ever flips inside a transaction, so it is never visible to
another connection; and .dockerignore excludes local env files
from the build context.

Two things the audit left open. `npm audit` could not run from
this machine (the registry audit endpoint is blocked by egress
policy), so it stays a pre-deploy step on an unrestricted
network. And the observations that describe designed behavior —
agent-run write amplification inside the hard limits, the
documented NFKC folds, the known tail-truncation limit, the
rejection-triggered rate-limiter pruning — were left as they
are, deliberately.
