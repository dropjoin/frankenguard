# Tech steering: Frankenguard

## Stack

- Plain HTML, CSS, and JavaScript. No framework, no bundler, no build
  dependencies. The demo must run anywhere a browser runs, including from
  a single deployed file.
- Node.js (v24) for tests and the build script. Standard library only:
  `node:test`, `node:assert`, `node:crypto`, `node:fs`.
- The rule engine, parser, and ledger are pure modules with no DOM access
  so the exact code that runs in the browser is the exact code the tests
  exercise. Modules use a UMD-style export (`module.exports` when present,
  otherwise a browser global) so one file serves both runtimes.
- Deployment: one static file served by a Cloudflare Worker on a custom
  subdomain. The build script inlines the source modules into
  `dist/index.html`. No server-side state; the ledger persists in
  `localStorage` under a versioned key.

## Money handling

- All amounts are integer minor units (cents) from the moment they are
  parsed. Floats never hold money. This is the single most important
  implementation rule in the project.
- Parsing rejects: non-finite values, zero or negative amounts, more than
  two decimal places, scientific notation, non-ASCII digits, and amounts
  above a sanity ceiling ($10,000,000). The parser reports which rule
  failed; it never silently coerces.
- Display formatting is the only place decimals reappear, via integer
  division, never via float multiplication.

## Dates and the daily cap

- The daily window is a UTC calendar day. This is documented on the page
  and in the spec, including its known edge: spending just before and just
  after midnight UTC can total twice the daily cap within minutes. The
  semantics are kept deliberately simple and visible rather than hidden
  behind a rolling window nobody can reason about.

## Ledger

- SHA-256 hash chain. Each entry stores the hash of the previous entry plus
  its own payload hash. Genesis previous-hash is the constant
  `FRANKENGUARD-GENESIS`.
- Hashing is injected: the browser passes a WebCrypto-based function, Node
  tests pass a `node:crypto` function. The ledger module never imports a
  platform API directly.

## Conventions

- Reason codes are SCREAMING_SNAKE_CASE and stable: `FROZEN`, `OVER_TX_CAP`,
  `OVER_DAILY_CAP`, `PAYEE_NOT_ALLOWLISTED`, `MEMO_GUARDRAIL`,
  `AMOUNT_INVALID`, `PROPOSAL_MALFORMED`, `PASS`.
- Gate evaluation order is fixed and documented: freeze, amount validity,
  per-tx cap, daily cap, allowlist, memo guardrail. The verdict trace shows
  every gate, including the ones that passed.
- No secrets anywhere in the repo. No API keys, no tokens, no credentials.
  The secret scan in `scripts/verify.mjs` runs before every push.
- Page title uses `|` as separator. Never an em dash in a tab title.
