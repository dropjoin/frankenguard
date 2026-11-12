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
