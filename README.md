# FrankenGuard

An AI agent proposes payments. A deterministic rule engine from another
era cross-examines every single one. No model in the decision path, no
vibes, no exceptions.

Built with Kiro for Kiroween 2026, Frankenstein category. Solo entry by
M Aziz Yahya ([dropjoin](https://github.com/dropjoin)).

## The idea in one paragraph

I let AI agents do things on my behalf, and the part that always scared
me was spending. An agent that can suggest a payment can also be talked
into suggesting a bad one: a prompt injection in a memo, a payee that
looks almost right, an amount just over the limit. So I built the
boundary I wanted: the agent proposes, and a stubborn, boring,
1970s-style rule engine judges the proposal against a freeze switch, a
recipient allowlist, a per-transaction cap, and a daily cap. The memo
is displayed and never read by the decision: an instruction hidden in
it changes nothing, and the demo proves that with a dedicated scenario.
Every verdict lands in a hash-chained audit log you can verify in one
click. The monster metaphor is not decoration: the app is mismatched
parts stitched together, and each part does exactly one job.

## Try it

```sh
npm ci
npm run build
npm start
```

Open http://localhost:3000. No login, no wallet, nothing to install
beyond Node 20+. A two-minute guided tour is in
[DEMO.md](DEMO.md). Deployment (Docker or plain Node) is in
[docs/deployment.md](docs/deployment.md).

## How it decides

Four rules, fixed order, every rule evaluated even after one fails, so
every verdict carries exactly four reasons:

| Order | Rule | What it checks |
|---|---|---|
| 1 | Freeze | The freeze switch rejects everything before any other rule matters. |
| 2 | Allowlist | Exact match after Unicode normalization and case folding. Empty never matches. |
| 3 | Per-transaction cap | Default $500. Exactly at the cap passes. |
| 4 | Daily cap | Default $1,000 per UTC calendar day, counted from executed payments. Exactly at the cap passes. |

APPROVED means all four passed. Anything else is REJECTED, and the card
names every rule that failed. Amounts are integer cents, USD only, at
most $1,000,000 per transaction. The engine is a pure function: same
proposal, same policy, same ledger state, same verdict, always. It has
no clock, no I/O, no randomness, and no model anywhere near it.

The agent that proposes comes in two forms. The scripted agent runs six
fixed scenarios: a payment that passes, one over the per-transaction
cap, one over the daily cap, one to an unknown recipient, one while
frozen, and the prompt-injection memo. The live agent is disabled by
default; with `AGENT_PROVIDER=live` and an API key it calls a model once
per run, the model is never told the caps, the spend, or the verdicts,
and any failure falls back to the scripted happy path with the UI
saying so. Either way, the proposal goes through the same four rules
and the same ledger.

## What is real and what is not

Real: the rule engine, the SQLite audit chain with append-only
triggers, the sandbox model (cookie-scoped, 60-minute idle expiry,
4-hour absolute cap), the rate limits, the scripted scenarios, the 349
unit and component tests, the 20 end-to-end tests including an axe
accessibility pass, and the tamper demo that breaks the chain at a
named entry.

Not real: the money. Nothing here connects a wallet, signs anything, or
calls a payment rail. The vendors (Acme Corp, Globex Corp, Initech) are
fictional demo data. The audit chain is verifiable, not tamper-proof:
verification recomputes the chain it is given and cannot detect entries
removed from the end of the log, and the UI says so next to the Verify
button.

Known edge, documented rather than hidden: the daily cap resets at UTC
midnight, so spending just before and just after midnight can total
twice the daily cap within minutes. I kept the simple calendar-day
semantics because a rolling window would be harder to reason about in a
demo, and I would rather document an edge than hide one.

## How Kiro was used

Development followed Kiro's spec-driven workflow, and the evidence is
in the repo:

- **Specs first.** `.kiro/specs/frankenguard/` holds EARS requirements,
  a design doc with module contracts, and a task list in eight phases.
  The spec was generated in a Kiro Web session; the session display
  truncated some passages, and
  `.kiro/specs/frankenguard/RETRIEVAL-NOTES.md` marks every passage
  that could not be verified verbatim. Each gap was derived from the
  complete requirements plus the design prose, and every derivation is
  listed in [BUILD-JOURNAL.md](BUILD-JOURNAL.md), never presented as
  Kiro-verbatim.
- **Steering docs** in `.kiro/steering/` hold the rules I refused to
  negotiate: integer cents, fail closed, no real money, honest demo
  data, light-only theme with computed contrast.
- **Agent hooks** run the test suite on save and the full
  typecheck + lint + test + build chain before commit.
- **A reviewer agent** in `.kiro/agents/` encodes the skeptical review
  posture: verify by running the tests and the endpoints, never by
  reading the code and nodding.

The full story, including what broke and what the tests caught, is in
[BUILD-JOURNAL.md](BUILD-JOURNAL.md).

## Run it yourself

```sh
npm test          # 349 Vitest tests: engine, services, API, components
npm run test:e2e  # 20 Playwright tests: journey, axe, layout (2 viewports)
npm run typecheck # both TypeScript configs, strict
npm run lint      # eslint, flat config
npm run build     # server + client into dist/
npm run dev       # API + Vite dev server with proxy
npm run smoke     # boots the built server, checks page + sandbox flow
npm run screenshots  # 6 states x 3 viewports into screenshots/
```

## Repo map

```
.kiro/          steering, specs, hooks, reviewer agent
src/shared/     money, clock, ids, canonical JSON, types, errors
src/engine/     pure rule engine: validate, rules, evaluate
src/services/   proposals, config, audit chain + queries, sandboxes
src/agents/     scripted scenarios, live agent, orchestration
src/api/        Fastify server, schemas, rate limits, entrypoint
src/db/         schema, migrations, repositories
src/web/        React client: panels, art, theme tokens
scripts/        smoke + screenshot drivers
tests/          Vitest suites (node + web) and Playwright specs
docs/           research, competitor scan, color study, deployment
screenshots/    the six states at 375/768/1280, committed
```

## License

MIT. See [LICENSE](LICENSE).
