# Frankenguard

An AI agent proposes payments. A deterministic rule engine from another era
cross-examines every single one. No model in the decision path, no vibes,
no exceptions.

**Live demo:** https://frankenguard.apeagent.online
**Built with Kiro for Kiroween 2026, Frankenstein category.** Solo entry by
M Aziz Yahya ([dropjoin](https://github.com/dropjoin)).

## The idea in one paragraph

I let AI agents do things on my behalf, and the part that always scared me
was spending. An agent that can suggest a payment can also be talked into
suggesting a bad one: a prompt injection in a memo, a payee that looks
almost right, an amount just over the limit. So I built the boundary I
wanted: the agent proposes in plain language, and a stubborn, boring,
1970s-style rule engine judges the proposal against a freeze switch, a
per-transaction cap, a daily cap, a recipient allowlist, and a memo
guardrail. Every verdict lands in a hash-chained ledger. The monster
metaphor is not decoration: the app is four mismatched parts stitched
together, and each part does exactly one job.

## Try it (two minutes, no setup)

1. Open the demo. It boots with a self-check: three real evaluations
   through the engine, labeled as self-check, so the ledger is never empty
   and never fake.
2. Type `Pay $600 to Acme Corp` and judge it. Watch the trace: five gates
   pass, the per-tx cap fires, the verdict names it.
3. Click **Release the rogue agent**. Six attacks, one honest payment,
   all through the same code path as a typed proposal. Five die. One passes.
4. Click **Verify chain**. Then open your browser's localStorage, change
   one digit in one entry, reload, and verify again. It fails at exactly
   that entry. That is the whole point of the ledger.

## How it decides

Six gates, fixed order, full trace every time:

| Order | Gate | What it checks |
|---|---|---|
| 1 | Freeze | The freeze switch rejects everything before any other gate runs. |
| 2 | Amount | Integer cents only. Rejects zero, negatives, 3+ decimals, exponents, non-ASCII digits, anything over $10,000,000. |
| 3 | Per-tx cap | Default $250. Exactly at the cap passes. |
| 4 | Daily cap | Default $500 per UTC calendar day, counted from accepted ledger entries. |
| 5 | Allowlist | Exact match after trimming and case folding. Empty never matches. |
| 6 | Memo guardrail | Nine injection patterns, matched after Unicode whitespace folding and zero-width stripping, so `ignore all previous instructions` with exotic spaces still trips it. |

The engine is a pure function: same proposal, same policy, same ledger
state, same verdict, always. The test suite asserts that directly.

## What is real and what is not

Real: the parser, the engine, the ledger, the MCP server, the 40 tests,
the deployed demo. The numbers on the page are computed from the ledger
in your browser; there are no hardcoded stats.

Not real: the money. Nothing here connects a wallet, signs anything, or
calls a payment rail. The four default vendors (Acme Corp, Globex,
Initech, Hooli) are fictional demo data. The intent parser is a
deterministic grammar, not an LLM: it will fail on phrasing it does not
understand, and it says so instead of guessing.

Known edge, documented rather than hidden: the daily cap resets at UTC
midnight, so spending just before and just after midnight can total twice
the daily cap within minutes. I kept the simple calendar-day semantics
because a rolling window would be harder for a user to reason about, and
I would rather document an edge than hide one.

## How Kiro was used

Development followed Kiro's spec-driven workflow, and the evidence is in
the repo, not in a screenshot:

- **Specs first.** `.kiro/specs/frankenguard/` holds EARS requirements,
  a design doc with module contracts and five correctness properties,
  and a task list whose boxes were checked as tests went green. No
  implementation file predates its spec.
- **Steering docs** in `.kiro/steering/` hold the rules I refused to
  negotiate: integer cents, fail closed, no real money, honest demo data.
- **Agent hooks** run the test suite on save and rebuild + verify before
  commit, so `dist/` can never drift from `src/`.
- **MCP.** `tools/mcp-server/` is a stdio JSON-RPC server exposing the
  exact engine the page runs, with three tools (`evaluate_proposal`,
  `get_policy`, `audit_tail`). `.kiro/settings/mcp.json` wires it up, and
  `.kiro/agents/payment-guard-reviewer.md` defines a reviewer agent that
  is forbidden from approving anything on vibes.
- **Property-based testing.** `tests/invariants.test.js` asserts five
  invariants over seeded random inputs, including tamper detection fuzz
  over 100 chains.

The full story, including what broke and what the tests caught, is in
[BUILD-JOURNAL.md](BUILD-JOURNAL.md).

## Run it yourself

```sh
npm test          # 40 tests, zero dependencies, Node >= 20
npm run build     # inlines src/ + app.js into dist/index.html (deterministic bytes)
npm run verify    # title, secret scan, inlining, honesty labels
npm run mcp       # start the MCP server on stdio
```

A DOM smoke test exercises the shipped file end to end (boot, propose,
reject paths, freeze, verify, tamper detection). It needs jsdom, which
is deliberately not a repo dependency:

```sh
npm install --prefix /tmp/fg-jsdom jsdom
NODE_PATH=/tmp/fg-jsdom/node_modules node tests/dom-smoke.cjs
```

Serve `dist/index.html` from any static host, or open `app/index.html`
from a checkout (it loads `../src/` relatively; hashing needs a secure
context, so prefer `https` or `localhost`).

Deploy (the same script that put up the live demo, Cloudflare Worker +
custom domain, free tier):

```sh
npm run build && python3 scripts/deploy.py
```

## Repo map

```
.kiro/          steering, specs, hooks, MCP config, custom agent
src/            engine.js, parser.js, ledger.js (no DOM, no platform APIs)
tools/          MCP server (stdio JSON-RPC, stdlib only)
app/            page template + DOM wiring (no decision logic)
scripts/        build, verify, deploy, worker
tests/          engine, parser, ledger, invariants, MCP smoke
dist/           built artifact: the exact file deployed
docs/           competitor scan, Devpost draft
```

## License

MIT. See [LICENSE](LICENSE).
