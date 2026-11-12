# Tech steering: FrankenGuard

## Stack

- TypeScript, strict mode, Node 20+. The server is Fastify 5 with
  better-sqlite3 and zod. The frontend is React 18 + Vite.
- Tests: Vitest (node + jsdom projects) and Playwright for
  end-to-end. Every phase leaves the repo building with tests
  passing; verify steps are run for real, never claimed.
- One SQLite database, WAL mode, `synchronous = FULL`. The schema
  lives in `src/db/schema.sql` and is copied into the server build
  output; migrations track `schema_version`.
- Deployment: the Fastify server serves the API and the built SPA
  from one process (see the Dockerfile). No serverless, no
  localStorage ledger.

## Money handling

- All amounts are integer cents from the moment they are parsed.
  Floats never hold money. This is the single most important
  implementation rule in the project.
- The manual form converts decimal input to cents with a strict
  grammar (no floats, no scientific notation, at most two decimal
  places, non-ASCII digits rejected). Display formatting is the
  only place decimals reappear, via integer division, never via
  float multiplication.
- USD only. One transaction at most $1,000,000; daily totals at
  most $10,000,000.

## Dates and the daily cap

- The daily window is a UTC calendar day. This is documented on
  the page, including its known edge: spending just before and
  just after midnight UTC can total twice the daily cap within
  minutes. The semantics are kept deliberately simple and visible
  rather than hidden behind a rolling window nobody can reason
  about.
- The server clock is clamped non-decreasing per sandbox, so a
  backward clock jump never resurrects an expired sandbox.

## Rules and reason codes

- Four rules, fixed order: FREEZE, ALLOWLIST, PER_TX_CAP,
  DAILY_CAP. All four are evaluated even after a failure; a
  decision always carries exactly four reasons. APPROVED if and
  only if all four pass.
- Reason codes are SCREAMING_SNAKE_CASE and stable:
  NOT_FROZEN, SYSTEM_FROZEN, RECIPIENT_ALLOWED,
  RECIPIENT_NOT_ALLOWED, WITHIN_PER_TX_CAP, PER_TX_CAP_EXCEEDED,
  WITHIN_DAILY_CAP, DAILY_CAP_EXCEEDED, plus INVALID_PROPOSAL and
  ENGINE_ERROR for the paths where no rule ran.
- The engine is pure: no I/O, no database, no clock, no LLM, no
  randomness. A purity guard test enforces the import boundary.

## Audit ledger

- SHA-256 hash chain, per sandbox. Each entry's hash covers the
  previous hash plus the canonical JSON of the entry (sorted keys,
  no whitespace, integers only). Genesis previous-hash is 64
  zeros. The chain is append-only, enforced by SQLite triggers.
- Canonical JSON rejects floats, NaN, Infinity, undefined, and
  non-plain objects. The chain never stores a float.

## Layering

- Import order: shared, engine, services, agents, api. The engine
  imports only shared. Services own transactions. Agents produce
  proposals and never touch the database. The API translates HTTP
  to services and back, and owns nothing else.
- No circular imports anywhere.

## Conventions

- No secrets anywhere in the repo. No API keys, no tokens, no
  credentials. The live agent is disabled by default and takes its
  key from the environment only.
- Page title uses the project name only. Never an em dash in a tab
  title.
- Light-only theme. No dark mode, no dark toggle. Design tokens
  live in exactly one CSS file; contrast pairs are verified by
  computation, never by eye.
