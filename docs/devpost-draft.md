# Devpost submission draft: Frankenguard (DO NOT SUBMIT FROM THIS FILE)

Category: Frankenstein. Solo entry. All fields in English.
Video link and final Kiro-usage wording to be completed before submitting;
everything else below is final copy.

---

## Title

Frankenguard: the agent proposes, the monster decides

## Tagline

An AI agent proposes payments in plain language. A deterministic rule
engine cross-examines every one: freeze, caps, allowlist, memo guardrail.
Every verdict lands in a hash-chained ledger.

## Links

- Live demo: https://frankenguard.apeagent.online
- GitHub repo: https://github.com/dropjoin/frankenguard
- Demo video: [ADD PUBLIC YOUTUBE LINK, UNDER 3 MINUTES]

## Description

### Inspiration

I let AI agents do things on my behalf, and spending is the part that
always scared me. An agent that can suggest a payment can be talked into
suggesting a bad one: an instruction hidden in a memo, a payee that looks
almost right, an amount just over the limit. I wanted a hard, inspectable
boundary between "the agent suggested it" and "the money moved", and I
wanted the boundary to be boring on purpose: no model, no judgment calls,
just rules. Kiroween's Frankenstein category was the excuse to stitch
that boundary together from parts that were never meant to fit: a
1970s-style rule engine, a 2020s agent workflow, and a tamper-evident
ledger.

### What it does

Frankenguard is a payment guard for AI agents. You type an instruction
the way an agent would ("Pay $180 to Acme Corp for invoice INV-1042").
A deterministic parser extracts the payee, amount, and invoice ref. A
rule engine judges the proposal through six gates in fixed order: freeze
switch, amount validity, per-transaction cap ($250 default), daily cap
($500 per UTC day), recipient allowlist, and a memo guardrail that
catches instruction injection even when it is hidden with Unicode
whitespace. Every verdict comes with the full gate trace, and every
verdict and policy change lands in a SHA-256 hash-chained audit ledger
you can verify in one click, export as JSON or CSV, and tamper with to
watch verification fail at exactly the edited entry.

A rogue-agent simulator fires six scripted attacks through the same code
path as a typed proposal: an over-cap payment, an injection memo, an
unknown payee, a payment while frozen, an amount trick (`$1e3`), and one
honest payment that passes. Five die. One passes. The policy panel lets
you change caps, edit the allowlist, and flip the freeze switch, with
every change written to the ledger.

### How we built it

Spec-first, in Kiro's spec-driven workflow. EARS requirements, a design
doc with module contracts and five correctness properties, and a task
list were written in `/.kiro/specs` before the first line of
implementation, and boxes were checked as tests went green. Steering
docs in `/.kiro/steering` hold the non-negotiables: integer cents, fail
closed, no real money, honest demo data.

The stack is deliberately unfashionable: plain HTML, CSS, and JavaScript,
no framework, no bundler, no dependencies. The rule engine, parser, and
ledger are pure modules with no DOM access, so the exact code the browser
runs is the exact code the tests exercise. A build script inlines the
modules into one deterministic file served by a Cloudflare Worker on a
custom subdomain. The ledger persists in localStorage; nothing leaves
the browser.

Kiro agent hooks run the 40-test suite on save and rebuild + verify
before commit. An MCP server (stdio JSON-RPC, stdlib only) exposes the
same engine to agents through three tools, wired up in
`.kiro/settings/mcp.json`, with a custom reviewer agent defined in
`.kiro/agents/` that is forbidden from approving anything on vibes.

### Challenges we ran into

The amount grammar fought back. Invoice numbers (`INV-1042`) kept
threatening to become payments, `1e3` and `1.234` had to fail loudly
instead of parsing into something plausible, and a lowercase `inv-`
prefix slipped past the first regex until a test caught it. The build
script hit the classic `String.replace` `$'` trap when inlining source
files. The DOM smoke test crashed on jsdom's missing WebCrypto, which
exposed a real gap: the app now fails visibly when hashing is
unavailable instead of dying silently. The full story, including the
UTC-midnight daily-cap edge I chose to document rather than hide, is in
the repo's build journal.

### Accomplishments that we're proud of

- A decision loop a judge can attack in under a minute, with a verdict
  trace that shows every gate, including the ones that passed.
- 40 tests, zero dependencies, including property-style invariants over
  seeded random inputs and tamper-detection fuzz over 100 chains.
- A DOM smoke test that exercises the shipped file end to end: boot,
  propose, reject paths, freeze, verify, tamper detection.
- A deterministic build: two runs produce byte-identical output, and the
  deployed file's SHA-256 was verified after deploy.
- Honest limits stated on the page: no real money, fictional vendors, a
  deterministic parser that is not an LLM, and the UTC-midnight edge.

### What we learned

Determinism is a feature you can demo. The moment the engine became a
pure function, everything else got easier: tests became assertions about
behavior instead of snapshots, the MCP server became a thin wrapper, and
the verdict trace became trustworthy because there was nothing hidden
behind it. The second lesson: the trace is the product. A guard that
says "no" without showing its work is just another black box, and nobody
trusts a black box with their money.

### What's next for Frankenguard

A second demo currency with explicit conversion rules, a rolling-window
daily cap as an opt-in policy with the trade-off explained in the UI,
and a hosted multi-user mode where the ledger is shared and the policy
is per-workspace. The engine stays deterministic; the parts around it
get bigger.

## How Kiro was used (write-up)

[FINALIZE WITH THE KIRO WEB SESSION RECORD BEFORE SUBMITTING. Draft
below describes the real artifacts in the repo; replace/extend with the
session specifics.]

Frankenguard was built with Kiro's spec-driven workflow. The work
started in `/.kiro/specs/frankenguard/`: EARS requirements defining
exactly what the parser, engine, and ledger must do; a design document
with module contracts, the six-gate order, and five correctness
properties; and a task list that was checked off as each piece landed
with passing tests. Steering documents in `/.kiro/steering/` carried the
project's standing rules across every session: integer minor units for
all money, fail-closed behavior on malformed input, no real money
movement, and honest demo data.

Kiro's agent hooks automated the discipline: the full test suite runs on
every save, and the build + static verifier run before every commit, so
the deployed file can never drift from the source. The MCP integration
goes both ways: a local MCP server exposes the rule engine itself as
three tools, so a Kiro agent can evaluate proposals, read the policy,
and verify audit chains using the exact code the demo runs, and a custom
reviewer agent in `.kiro/agents/` encodes the skeptical review posture
as a reusable definition.

Property-based testing was part of the Kiro workflow from the design
doc: the five invariants (PASS implies all gates passed, daily spend
never exceeds the cap, tamper detection, integer-only amounts, freeze
rejects everything) are asserted over seeded random inputs, and the
tamper fuzz builds and breaks 100 chains per run.

## Built With

Kiro, JavaScript, Node.js, Cloudflare Workers, WebCrypto (SHA-256),
JSON-RPC (MCP over stdio). Zero runtime dependencies.

## Try it out

- Live demo: https://frankenguard.apeagent.online
- GitHub repo: https://github.com/dropjoin/frankenguard
- No login needed. No wallet. Nothing to install.
- Suggested first three actions: judge `$600 to Acme Corp`, release the
  rogue agent, click Verify chain.
