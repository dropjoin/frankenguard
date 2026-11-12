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
