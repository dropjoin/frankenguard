# Structure steering: FrankenGuard

```
frankenguard/
  .kiro/
    steering/      product.md, tech.md, structure.md (this file)
    specs/
      frankenguard/  requirements.md, design.md, tasks.md, RETRIEVAL-NOTES.md
    hooks/         agent hook configs (test-on-save, verify-before-commit)
    agents/        custom agent definitions
  src/
    shared/        types.ts, money.ts, clock.ts, ids.ts, canonicalJson.ts, errors.ts
    engine/        rules/{freeze,allowlist,perTxCap,dailyCap}.ts, evaluate.ts, validate.ts, window.ts, clientOnly.ts
    db/            schema.sql, migrate.ts, repositories.ts
    services/      proposals.ts, config.ts, sandbox.ts, limits.ts, audit/{chain.ts, queries.ts}
    agents/        types.ts, scripted.ts, live.ts, run.ts
    api/           schemas.ts, server.ts, rateLimit.ts, main.ts
    web/           Vite + React app (src/web/src: App.tsx, api.ts, theme/, components/)
  tests/           Vitest suites mirroring src/ (shared/, engine/, db/, services/, agents/, api/, web/)
  e2e/             Playwright specs against the built server
  docs/            research.md, competitor-scan.md, color-study.md, devpost-draft.md, DEMO.md
  dist/            build output (server/ + web/); generated, never edited
  BUILD-JOURNAL.md dated notes: decisions, derivations, what tests caught
  README.md
  LICENSE
```

## Rules

- `src/engine/` never imports the database, services, agents, or
  the API, and never touches `Date`, `Math.random`, `fetch`, or
  `process`. The purity guard test fails the build if it does.
- `src/services/` owns transactions: one `BEGIN IMMEDIATE` per
  submit, decision and audit writes atomic. No service writes SQL
  outside the repositories and the audit chain module.
- `src/agents/` never touches the database. Agents return
  proposals; the run orchestration submits them through
  ProposalService like any other caller.
- `src/web/` never makes a policy decision. It renders server
  state, collects input, and calls the API. A verdict computed in
  the browser is a bug.
- `dist/` is generated. Never edit it by hand; edit the source
  and run `npm run build`.
- Tests live under `tests/`, mirroring the `src/` layout, plus
  `e2e/` for Playwright. A test file is named after what it
  proves.
- Derivations (gaps in the retrieved Kiro spec filled from the
  requirements plus design prose) are recorded in BUILD-JOURNAL.md
  with a D-number, and never presented as Kiro-verbatim.
