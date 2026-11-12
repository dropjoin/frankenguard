# Implementation Plan: FrankenGuard

Ordered, small, testable tasks implementing design.md against requirements.md. Each task lists what to build, how to verify it, and the requirements it covers. Tasks are meant to be done in order; each should leave the repo building with tests passing.

## Conventions
- Language and stack per design section 2.1 (TypeScript strict, Fastify, React + Vite, SQLite via better-sqlite3, Zod, Vitest).
- Tests named in a task are part of that task. Tasks marked * are optional/stretch.
- Time is always injected (a Clock interface); no module outside Clock reads the system time.
- Status: none of these tasks have been started.

## Phase 0: Project foundation
### 0.1 Scaffold the repository
- Create package.json (workspaces or single package), tsconfig (strict), Vitest, ESLint, Prettier, and the folder layout from design 2.4.
- Scripts: dev, build, test, lint, typecheck.
- Verify: npm run typecheck && npm run lint && npm test pass on a placeholder test.
- Covers: project setup.
### 0.2 Shared primitives: money, ids, clock, canonical JSON
- shared/money.ts (cents helpers, formatUsd), shared/clock.ts (Clock, SystemClock, FakeClock), shared/ids.ts (ULID, random sandbox id), shared/canonicalJson.ts (sorted keys, no whitespace, rejects floats/undefined/NaN).
- Verify: unit tests: key ordering, nested objects, float rejection, formatUsd(75000) === "$750.00", FakeClock advance.
- Covers: R6.7 (canonical form), design 3.5.
### 0.3 Shared types, reason codes, and Zod schemas
- shared/types.ts: Outcome, RuleName, Reason, ReasonCode, ConfigSnapshot, ProposalInput, ValidProposal, API request/response schemas.
- Verify: typecheck; schema parse tests for good/bad examples.
- Covers: R1.2, R2.7; design 3.2, 6.3.

## Phase 1: Rule engine (pure, no I/O)
### 1.1 Proposal validation and recipient normalization
- engine/validate.ts: validateProposal(input) → { ok, value } | { ok:false, fields[] } per design 4.5. normalizeRecipient (trim, NFKC, lowercase, reject control chars, 1–64 chars).
- Verify: tests for: amount 0, negative, float, string, > 1,000,000,000, non-USD, memo 281 chars, empty recipient, control chars, whitespace-only, over-long recipient.
- Covers: R1.2, R1.3, R4.3.
### 1.2 Freeze rule
- engine/rules/freeze.ts: pure function returning a Reason.
- Verify: tests for frozen true/false; message and detail content.
- Covers: R5.1, R2.10.
### 1.3 Allowlist rule
- engine/rules/allowlist.ts: exact match on normalized key; empty list fails.
- Verify: tests: match, miss, empty list, case/whitespace variants, near-miss (prefix) fails.
- Covers: R4.1–R4.4.
### 1.4 Per-transaction cap rule
- engine/rules/perTxCap.ts (inclusive).
- Verify: boundary tests: cap−1, cap, cap+1.
- Covers: R3.1, R3.2, R3.7.
### 1.5 Daily cap rule and window helper
- engine/rules/dailyCap.ts (inclusive; remainingCents in detail). engine/window.ts: utcDayWindow(date) → {start, end}.
- Verify: tests: spent+amount = cap passes, +1 fails, spent already over cap, 23:59:59.999Z vs 00:00:00.000Z window assignment, leap day, month/year boundary.
- Covers: R3.3–R3.7; design 4.4.
### 1.6 evaluate combining the four rules
- engine/evaluate.ts: fixed order FREEZE → ALLOWLIST → PER_TX_CAP → DAILY_CAP; always exactly 4 reasons; APPROVED iff all pass.
- Verify: unit tests for each single-rule failure and multi-failure combos (e.g. frozen + over cap shows both) APPROVED ⇔ all pass.
- Covers: R2.1, R2.2, R2.4–R2.7, R5.3.
### 1.7 Engine purity guard
- A test/lint rule that src/engine/** imports nothing from db, services, agents, api, Node fs/net/http, and does not reference Date, Math.random, or fetch.
- Verify: the guard test fails on a deliberately bad import in a temp fixture and passes on the real code.
- Covers: R2.3, R2.10.

## Phase 2: Persistence
### 2.1 Schema and migrations
- db/schema.sql per design 3.1, db/migrate.ts with a schema_version table; openDb(path|":memory:") enables WAL and foreign keys.
- Verify: migrating a fresh in-memory DB produces all tables; re-running is a no-op.
- Covers: design 3.1.
### 2.2 Integrity triggers
- Add the triggers from design 3.3: audit no-update, audit no-delete (unless sandbox purging), audit seq contiguity, decisions immutable, payments need an APPROVED decision, payments immutable (RECEIVED → EXECUTED|BLOCKED once).
- Verify: DB tests attempt each forbidden operation and assert it throws; assert allowed paths (insert contiguous seq, sandbox purging) succeed.
- Covers: R1.7, R6.5, R6.6, R6.4.
### 2.3 Audit hash chain module
- services/audit/chain.ts: computeHash(prevHash, entry), appendAudit(tx, sandboxId, entry) (assigns seq and prev_hash from the tail, inserts), verifyChain(db, sandboxId).
- Verify: tests: genesis prev_hash is 64 zeros; known-vector hash; verify passes on N entries; on a test DB with a row altered mid-chain, verify returns ok:false with brokenAtSeq; tail truncation is not detected (documented test).
- Covers: R6.4, R6.7, R6.8; design 3.5.
### 2.4 Repositories
- Typed repos for sandboxes, config, allowlist, proposals, decisions, payments, with the insertPayment(decisionId, …) signature from design 2.3. payments.sumForWindow(sandboxId, start, end).
- Verify: CRUD tests on in-memory DB; sumForWindow respects [start, end) and sandbox isolation.
- Covers: R3.3, R7.5.
### 2.5 Sandbox seeding and lifecycle service
- SandboxService.create() seeds config (50,000¢ / 100,000¢ / freeze OFF), the three allowlist entries, and SANDBOX_CREATED audit seq 1 (design 7). touch() refreshes last_seen/expires_at (60 min idle, 4 h absolute). reset() marks the old sandbox purging, purges it, and creates a new one. sweepExpired(now) purges expired sandboxes.
- Verify: tests with FakeClock: seed values; touch extends but caps at 4 h; sweep removes only expired sandboxes.
- Covers: R7.5–R7.8.

## Phase 3: Services
### 3.1 ProposalService.submit: happy and reject paths
- Implement the transaction from design 4.7 (BEGIN IMMEDIATE; persist; audit PROPOSAL_RECEIVED; validate; read state; compute window/spend; evaluate; persist decision with ConfigSnapshot; audit DECISION_MADE; on approve insert payment + PAYMENT_EXECUTED; set status). Invalid proposals follow the INVALID_PROPOSAL path.
- Verify: integration tests (in-memory DB + FakeClock): approved creates exactly one payment and 3–4 audit entries; invalid creates exactly one audit row and no decision/payment.
- Covers: R1.1–R1.7, R1.9, R2.1, R3.6, R6.1, R6.2, R6.9, R6.11.
### 3.2 Idempotency
- Same sandbox + key + same request_hash returns the original result with replayed: true; different body → IdempotencyKeyReused error (409).
- Verify: tests for replay (no new rows/payment/audit), conflicting body, same key in a different sandbox is independent.
- Covers: R1.8.
### 3.3 Fail-closed behavior
- Verify: tests for each injected fault: no payment row, outcome REJECTED / ENGINE_ERROR (or 503 when the second write also fails), earlier partial writes rolled back.
- Covers: R2.8, R5.8, R6.12; design 4.7.
- [Isi lengkap butir 3.3 pertama — Fault-injection hooks (test-only seam) for: config read failure, allowlist read failure, ledger sum ... ENGINE_ERROR recording and the 503 AuditUnavailable path. Missing/invalid config row → treated as frozen with ENGINE_ERROR. — tertangkap di panel, lihat catatan di akhir untuk ekor yang terpotong]
### 3.4 Concurrency and daily cap atomicity
- Test harness running many submit calls interleaved (multiple connections to a file-backed temp DB, or worker threads) near the daily cap.
- Verify: total executed in a UTC day never exceeds the daily cap across 200 randomized concurrent submissions; some proposals may be rejected (expected).
- Covers: R2.9, R3.4.
### 3.5 UTC rollover behavior
- Integration tests with FakeClock across midnight (including clamping against clock moving backward).
- Verify: spend at 23:59:59.999Z counts toward day D; at 00:00:00.000Z the daily total is 0 again; lowering the cap below spent leaves all later proposals blocked until the next day.
- Covers: R3.3–R3.5, R3.11; design 4.4.
### 3.6 ConfigService: caps
- updateCaps validates positive ints and perTx ≤ daily, bumps config_version, writes CAPS_CHANGED (old, new, actor, ts) in one transaction. Not retroactive.
- Verify: tests: invalid values → 422-mapped error with no state change and no audit entry; valid change audited; earlier decisions unchanged.
- Covers: R3.8–R3.12.
### 3.7 ConfigService: allowlist
- addRecipient, removeRecipient with normalization, duplicate detection (409), a max of 50 entries, ALLOWLIST_CHANGED audit.
- Verify: tests: duplicate after normalization rejected; removal leaves past decisions/payments untouched; emptying the list means all new proposals fail.
- Covers: R4.5–R4.8.
### 3.8 ConfigService: freeze switch
- setFrozen(frozen, note?) with FREEZE_CHANGED (previous, new, note, actor, ts), no caching.
- Verify: tests: freeze → next proposal REJECTED with SYSTEM_FROZEN plus truthful other reasons, and still fully audited; unfreeze → proposals approved again; freeze does not change earlier decisions.
- Covers: R5.1–R5.7, R5.9.
### 3.9 Audit query service
- listAudit({afterSeq, limit, outcome, code, recipient}), read-only; getProposalBundle(id) returning proposal + decision + payment + linked audit entries.
- Verify: tests for each filter and combinations, pagination, ordering by seq, sandbox isolation, bundle linkage.
- Covers: R6.10, R6.11.
### 3.10 Per-sandbox limits
- Enforce 500 proposals, 2,000 audit entries, 50 allowlist entries; throw SandboxLimitReached.
- Verify: tests at each limit boundary; writes beyond the limit do not partially persist.
- Covers: R7.17.

## Phase 4: Agents
### 4.1 Agent interface and scripted scenarios
- agents/types.ts, agents/scripted.ts with scenarios happy_path, over_per_tx, over_daily, unknown_recipient, frozen, prompt_injection (design 5.2). Define the over_daily sizing formula from current caps and today's spend, and document it in code comments.
- Verify: determinism test (same context → same proposals); each scenario run through submit on a fresh seeded sandbox produces its expected failing rule code(s); over_daily still crosses the cap after caps are edited and after prior spending; prompt_injection memo does not change the outcome (compare with identical proposal and benign memo).
- Covers: R7.9, R7.19, R1.10.
### 4.2 AgentService orchestration
- runAgent(sandbox, {scenario|prompt}) → gets proposals, assigns server-generated idempotency keys, submits each through ProposalService.submit only, returns results plus agentMode.
- Verify: test with a spy agent that tries to return an extra field (e.g. approved: true, bypass: true): extra fields are stripped/ignored; no code path other than submit creates payments (static test grep + DB trigger already covers).
- Covers: R7.15, R1.10.
### 4.3 Live agent adapter and fallback
- agents/live.ts behind env config (AGENT_PROVIDER, AGENT_API_KEY); structured output validated by Zod; ≤ 3 proposals; 10 s timeout. Fall back to scripted on any failure and set agentMode: 'scripted_fallback'. Provider SDK/HTTP call isolated in one function for mocking.
- Verify: tests with a mocked provider: valid output used; invalid JSON, timeout, >3 proposals, missing key each fall back to scripted and set agentMode: 'scripted_fallback'.
- Covers: R7.14, R7.15.

## Phase 5: API
### 5.1 Server skeleton, error mapping, and security headers
- Fastify app factory buildApp({db, clock, agents}); JSON error envelope; domain-error → status mapping (design 6.4); 8 KB body limit; CSP (default-src 'self', no inline scripts), X-Content-Type-Options, Referrer-Policy.
- Verify: tests with app.inject: error envelope shape, body-limit 413, headers present.
- Covers: R7.18; design 6.4, 6.5.
### 5.2 Sandbox session middleware and sandbox routes
- POST /api/sandbox, POST /api/sandbox/reset, cookie fg_sandbox (HttpOnly; Secure; SameSite=Lax), touch on every request, 401 SANDBOX_EXPIRED.
- Verify: tests: create sets cookie and seeds; repeat call is idempotent; expired/unknown cookie → 401; reset resets the sandbox.
- Covers: R7.1, R7.5–R7.8.
### 5.3 State and proposal routes
- GET /api/state, POST /api/proposals, GET /api/proposals/:id.
- Verify: tests: response shapes match design 6.3 (4 ordered reasons); invalid proposal → 200 with INVALID_PROPOSAL; replay returns replayed: true; state includes daily spent, remaining, window reset time, agent mode, audit head.
- Covers: R1.x, R5.10, R7.10, R7.12.
### 5.4 Config routes
- PUT /api/config/caps, POST/DELETE /api/config/allowlist…, PUT /api/config/freeze.
- Verify: tests: 422 on invalid caps, 409 on duplicate recipient, freeze toggle takes effect on the next proposal, each change appears in /api/audit.
- Covers: R3.8–R3.12, R4.5–R4.8, R5.4–R5.6, R7.11.
### 5.5 Agent route
- POST /api/agent/run for scenario or prompt; returns results array and agentMode.
- Verify: tests for every scenario through the HTTP layer; frozen scenario behaves per design 5.2 given freeze state; live agent disabled by default.
- Covers: R7.9, R7.14, R7.15.
### 5.6 Audit routes (read-only)
- GET /api/audit with filters and GET /api/audit/verify.
- Verify: tests: filters, pagination, verify ok/not ok (on a test DB with a tampered row); assert PUT/PATCH/DELETE on /api/audit*, /api/proposals*, /api/decisions*, /api/payments* return 404/405.
- Covers: R6.5, R6.8, R6.10, R7.13.
### 5.7 Rate limiting and abuse controls
- In-memory token buckets: per sandbox (30 write/min, 120 read/min), per IP (120/min), live agent 6/min per sandbox. Respond with 429 with Retry-After; map SandboxLimitReached to 429 SANDBOX_LIMIT_REACHED.
- Verify: tests with FakeClock: limits trigger and recover after the window; buckets are independent per sandbox; no cross-sandbox counting.
- Covers: R7.16, R7.17.
### 5.8 Sweeper job
- Interval job (every 60 s) calling sweepExpired; started in server.ts, stoppable in tests.
- Verify: test with FakeClock: expired sandbox is purged and its cookie then returns 401; active sandboxes untouched.
- Covers: R7.8.
### 5.9 API contract test of end-to-end flows
- Scenario tests through app.inject: full happy path, each rule failure, freeze round trip, cap edit, allowlist edit, reset, verify chain.
- Verify: all pass with assertions on audit contents (types and order) as well as responses.
- Covers: R1–R6 end-to-end.

## Phase 6: Frontend foundation and theme
### 6.1 Web app scaffold and API client
- Vite + React app in src/web, typed API client using the shared Zod schemas, a small state store (React Query or equivalent) with 401 handling that offers a new sandbox.
- Verify: component test with a mocked client: loading, error, and expired-sandbox states render.
- Covers: R7.1, R7.20.
### 6.2 Binding design tokens and global styles (light theme only)
- web/src/theme/tokens.css defining exactly the binding tokens in design 8.4.1 as CSS custom properties, with the specified names and values:
  - Base: --base-gray #F2F2F2, --base-sky #D7EBFF, --base-lavender #E9E2FF.
  - Secondary: --purple #673AB7, --amethyst #9B59B6, --blue #3498DB.
  - Accents: --pumpkin #FF5F1F (CTA), --electric #39FF14 (sparingly), --highlight #F1C40F.
  - Hero: --hero-start #8E2DE2, --hero-end #4A00E0, --hero-gradient.
  - Semantic: --success #16A34A, --warning #F59E0B, --error #EF4444, --info #0EA5E9.
  - Text colors (binding WCAG rules): --text-body #1F2937, --text-brand #673AB7, --text-brand-alt #7C3AED, --text-success #166534, --text-error #B91C1C, --text-warning #92400E, --text-info #0369A1, --text-blue #1D4ED8.
  - Supporting (non-text): --text-on-fill #111111 (CTA and bright-fill text), --on-color #FFFFFF (text on purple, amethyst, hero only), --stitch.
  - The earlier --ink and --ink-muted tokens do not exist.
  - Global styles: --base-gray page background, 16 px base, 44 px touch targets, focus indicator (2 px --text-body inner outline + 3 px --electric outer ring), prefers-reduced-motion handling. No dark-theme tokens.
- Verify: tests: (a) a token-conformance test parses tokens.css and asserts every binding token exists with exactly the specified value; (b) automated WCAG contrast [TERPOTONG — akhir tidak terverifikasi] #F2F2F2, #D7EBFF, and #E9E2FF, and every text-on-fill pair in the 8.4.1 contrast tables, must be ≥ 4.5:1 and match the published [TERPOTONG — akhir tidak terverifikasi] color only resolves to the eight text tokens, --text-on-fill, or --on-color; the bright colors (#16A34A, #EF4444, #F59E0B, #0EA5E9, #3498DB, #FF5F1F, #9B59B6, #F1C40F, #39FF14) are never used as color; CTA buttons use #111111 and never white; white text appears only on --purple, --amethyst, or the hero gradient; (c) CSS lint fails on prefers-color-scheme: dark and on any page/panel background with relative luminance below 0.6; (d) lint fails on raw hex values outside tokens.css, on light luminance below 0.6, and when --electric is used as a background outside the allow-listed small components (Dot, Bolt, Spark, FocusRing, StampTip) or as a text color.
- Covers: R7.20, R7.21; design 8.4.1, 8.4.6.
### 6.2a Typography: fonts and type scale
- Self-host WOFF2 variable fonts (Latin subset) for Space Grotesk (--font-display, headlines/display), Inter (--font-body, body/UI), and Geist Mono (--font-mono, code/hashes/terminal only), loaded with font-display: swap and preload for the two most-used files, with size-adjusted system fallbacks. Define type tokens: --text-base 1rem (16 px), --lh-body 1.6 (range 1.5 to 2.0), --lh-headline 1.1 (range 1.0 to 1.25; h1 1.05, h2 1.15, h3 1.25), --ls-display-1/2/3 (-0.04em / -0.03em / -0.02em), --ls-body 0, and five weights --fw-light 300, --fw-regular 400, --fw-medium 500, --fw-semibold 600, --fw-bold 700. Provide the heading/body/mono utility classes and the responsive type scale from design 8.4.1.
- Verify: tests: (a) token-conformance test asserts the font families, 16 px base, line-height and letter-spacing [TERPOTONG — akhir tidak terverifikasi] font-family outside the three tokens; (c) --font-mono is referenced only by code/hash/terminal components (audit payload, hash values, reason codes, verification).
- Covers: R7.20; design 8.4.1 (typography), 8.4.6 (items 6, 8).
### 6.3 Ghost mascot and SVG art kit
- Original inline SVG components: GhostMascot with states idle | approved | blocked | frozen | verified, MonsterHead (Frankenstein lab illustration: --success skin, --amethyst shading, --blue scar, --electric neck bolts), Bolt (--electric), SutureDivider (zig-zag), StitchBorder wrapper, jack-o'-lantern and snowflake icons, favicon. Colors come only from the binding tokens (ghost skin --purple, shading --amethyst, sparkle --highlight, stop sign --pumpkin, frozen tint --info, verified check --success). All aria-hidden when decorative.
- Verify: render tests for each state; snapshot tests; asset-weight test (< 60 KB total); test that SVG fills [TERPOTONG — akhir tidak terverifikasi]
- Covers: design 8.4.3, 8.4.4, 8.4.6 (items 3, 7).
### 6.4 Themed primitives
- Button (primary = --pumpkin CTA with --text-on-fill #111111 text and --font-display 600; secondary = --purple outline with --text-brand label), Badge (semantic fills with --text-on-fill text and icon), InlineMessage (success/error/warning/info text on plain light surfaces using --text-success / --text-error / --text-warning / --text-info, always with an icon), Link (--text-brand, hover/visited --text-brand-alt), StatusPill, Panel (stitched border; --base-lavender and --base-sky variants), Chip, Meter (--success / --warning / --error segments), Toggle (--purple when ON, --base-gray when OFF, --electric bolt ends), Banner (--warning / --error / --info).
- Verify: component tests: every status variant renders an icon and a text label (not color alone); only the primary Button uses --pumpkin; bright semantic colors are applied as fills/icons only and semantic text uses the text-safe tokens [TERPOTONG — akhir tidak terverifikasi] Button text computes to #111111; keyboard operability and visible focus indicator (--text-body outline + electric ring); reduced-motion disables animations.
- Covers: R7.21; design 8.4.2, 8.4.6.
### 6.5 Header band and simulated-money banner
- Header band using --hero-gradient with --on-color text, ghost logo, wordmark (Space Grotesk bold, --ls-display-1), status pill (ACTIVE with an --electric dot / --info FROZEN), agent-mode badge, and Reset button; --warning "SIMULATED MONEY ONLY" banner with jack-o'-lantern icon; footer "Built with Kiro 👻".
- Verify: component tests: banner always rendered; pill shows ❄ FROZEN (--info) when state is frozen and ● ACTIVE otherwise; header uses the hero gradient and no other component [TERPOTONG — akhir tidak terverifikasi] --on-color on the hero gradient) and banner text (--text-on-fill on --warning) contrast is covered by 6.2 tests.
- Covers: R5.10, R7.2, R7.14; design 8.4.2, 8.4.4.

## Phase 7: Frontend features
### 7.1 Page layout and responsive structure
- Five-panel layout per design 8.1 (two columns ≥ 1024 px; stacked Agent → Decision → Controls → Audit [TERPOTONG — akhir tidak terverifikasi] --base-lavender, Decision and Controls on --base-sky, page --base-gray) with shared stitch borders, SutureDividers.
- Verify: component/e2e checks at 375, 768, 1280 px: all panels present, no horizontal scroll, decorations do [TERPOTONG — akhir tidak terverifikasi]
- Covers: R7.20; design 8.1, 8.4.3, 8.4.6 (item 6).
### 7.2 Agent panel and manual proposal form
- Scenario buttons with icons (Frozen disabled with tooltip until freeze ON), optional live prompt box [TERPOTONG — akhir tidak terverifikasi]
- Verify: component tests: amount conversion to integer cents without float error (19.99 → 1999); Frozen scenario disabled/enabled; submitting disables the button during in-flight requests; server [TERPOTONG — akhir tidak terverifikasi] INVALID_PROPOSAL renders field messages.
- Covers: R7.9, R7.10, R1.2.
### 7.3 Decision panel
- Decision cards (6 px --success rail and --success badge for APPROVED; 6 px --error rail and --error badge for BLOCKED with "Caught by FrankenGuard!" copy; card backgrounds stay light panel surfaces; [TERPOTONG — akhir tidak terverifikasi] --text-on-fill), four rule rows in fixed order with a round semantic badge + icon, the message in --text-success (pass) or --text-error (fail), and the reason code in --font-mono, ghost mascot state driven by the latest outcome, "Agent proposal" ghost badge (--blue fill), --highlight stamp glow, lab strip with MonsterHead and four stamps that light in sequence, aria-live announcements, empty state ("The monster is sleeping.").
- Verify: component tests: approved/blocked/multi-failure render all four reasons in order; icon+text present; [TERPOTONG — akhir tidak terverifikasi] aria-live message content; agent text containing <img onerror> / <script> renders as literal text (no DOM elements created).
- Covers: R7.12, R7.18, R7.21; design 8.4.2–8.4.5.
### 7.4 Controls panel
- Caps form (dollar inputs, inline server validation errors), allowlist chip editor (add/remove), freeze [TERPOTONG — akhir tidak terverifikasi] --success up to 69%, --warning 70 to 99%, --error at 100%, track --base-lavender; captions in --text-success / --text-warning / --text-error ("cap reached" at 100%); amounts in --font-display with --text-body; plus UTC reset countdown). Inline validation errors use --text-error with an icon.
- Verify: component tests: cap validation messages (per-tx > daily); meter fill class and caption color at 0%, [TERPOTONG — akhir tidak terverifikasi] --text-error; freeze toggle calls API and updates header pill; all changes reflect after refetch.
- Covers: R3.8–R3.10, R4.5, R5.4, R5.10, R7.11.
### 7.5 Frozen-state theming
- When frozen: 4 px --blue page frame, --info header pill and --info top rail on the Controls panel (panel stays --base-sky), --info banner line "All payments are blocked" (--text-on-fill on the fill) with a --text-info explanation line, mascot frozen state, frame-wipe animation (≤ 500 ms, disabled under reduced motion [TERPOTONG — akhir tidak terverifikasi]
- Verify: component tests: frozen class/attributes toggle with state; reduced-motion renders final state witho [TERPOTONG — akhir tidak terverifikasi] --info and --blue pairs.
- Covers: R5.10; design 8.4.2, 8.4.5.
### 7.6 Audit panel and verify control
- Timeline with stitched dashed rail, entry-type chips (colors per design 8.4.2: lavender/ --purple border for received, --success / --error for decisions, --success for payments, --blue for config changes, with --text-on-fill labels), filters (outcome, reason code, recipient), expandable payload in a light terminal-style block [TERPOTONG — akhir tidak terverifikasi] --font-mono in --text-body on --base-gray, --purple left bar; never dark), linked-entry highlighting in --highlight for a selected proposal, "Verify chain" button with intact (--success badge with --text-on-fill, --text-success caption, small --electric sparks, --success stitched ring, entry count, short head hash in --font-mono) and broken (--error badge with --text-on-fill, --text-error caption, torn-stitch icon, offending row outlined in --error) states, the Verify button styled as a --pumpkin CTA, truncation caveat in help text, empty state.
- Verify: component tests: filters call the API with the right params; intact/broken states render icon + text [TERPOTONG — akhir tidak terverifikasi]
- Covers: R6.10, R6.11, R7.13, R7.21.
### 7.7 Motion and delight polish
- Decision slide/fade (≤ 250 ms), approved sparks (small --electric particles), blocked wiggle with stop-sign pop (≤ 400 ms), stamp sequence, floating ghost loop; every [TERPOTONG — akhir tidak terverifikasi] prefers-reduced-motion.
- Verify: tests: animation classes applied for normal motion, absent under reduced motion; no information conv [TERPOTONG — akhir tidak terverifikasi]
- Covers: design 8.4.5.
### 7.8 Empty, error, and limit states
- Friendly states: sandbox expired (new sandbox button), 429 rate-limit/ SANDBOX_LIMIT_REACHED (retry-after / reset prompt), 503 (audit unavailable, nothing executed), network failure.
- Verify: component tests for each error code's message and action; --warning banner styling for 401/429/limit states and --error banner for 503 (banner text --text-on-fill; any standalone message on a light surface uses --text-warning / --text-error), each with a --pumpkin action button.
- Covers: R7.8, R7.16, R7.17; design 9.
### 7.9 Accessibility pass
- Semantic landmarks, labelled inputs, focus order, aria-live regions, keyboard-only operation of all controls, aria-hidden on decoration, accessible names for icon-only buttons.
- Verify: automated axe checks (jest-axe or Playwright + axe) report no serious/critical violations on the mai [TERPOTONG — akhir tidak terverifikasi]
- Covers: R7.20, R7.21; design 8.4.6.

## Phase 8: Integration, e2e, and release
### 8.1 Serve the SPA from Fastify and wire configuration
- Static hosting of the built web app, SPA fallback that never shadows /api, env config (PORT, DB_PATH, AGENT_PROVIDER, AGENT_API_KEY, TRUST_PROXY), startup that runs migrations and starts the sweeper.
- Verify: a smoke test starts the built server on a temp DB, hits /, /api/state (401 without cookie), and POST /api/sandbox.
- Covers: R7.1.
### 8.2 End-to-end browser tests (Playwright)
- Scenarios: first visit creates a sandbox with the banner visible; run each scripted scenario and ass [TERPOTONG — akhir tidak terverifikasi]
- Verify: suite passes headless in CI at 1280 px and 375 px viewports.
- Covers: R7.1–R7.13, R7.18–R7.21.
### 8.3 Visual QA and theme acceptance
- Capture screenshots at 375/768/1280 px in default, approved, blocked, frozen, verified, and broken-c [TERPOTONG — akhir tidak terverifikasi] #1F2937, headings/links #673AB7 / #7C3AED, semantic text tokens, CTA text #111111, no neon or bright-semantic text); bright light-gray/sky/lavender base with the vivid hero header,
- Verify: checklist signed off; screenshots attached to the PR; automated theme tests (6.2) still green.
- Covers: R7.20, R7.21; design 8.4.7.
### 8.4 Containerize and deploy the public demo
- Dockerfile (multi-stage), persistent volume for DB_PATH, health endpoint GET /healthz, deployment notes. Live agent left disabled unless secrets are configured.
- Verify: the container starts, /healthz is 200, a sandbox can be created and a scenario run against the deployed URL; confirm the HTTPS cook [TERPOTONG — akhir tidak terverifikasi]
- Covers: R7.1, R7.3, R7.4.
### 8.5 Documentation and demo script
- README.md: what it is, the four rules, architecture diagram, run/test commands, env vars, limitations (tail t [TERPOTONG — akhir tidak terverifikasi] DEMO.md: a 2-minute judge walkthrough of the scenarios, freeze, and verify, plus the Kiro/Halloween/Franken [TERPOTONG — akhir tidak terverifikasi]
- Verify: a fresh clone follows the README and gets a working demo; commands in the docs are tested.
- Covers: hackathon deliverable.
### 8.6 Stretch: tamper demo
- Dev/demo-only "tamper with the log" action that edits an audit row on a privileged connection (trigg [TERPOTONG — akhir tidak terverifikasi]
- Verify: with the flag off the endpoint doesn't exist; with it on, verify reports brokenAtSeq; normal API surface still has no mutation path for audit entries.
- Covers: R6.8 demonstration (optional).

## Requirement Coverage Matrix
[Hanya judul yang ditampilkan di panel spesifikasi dan di bidang teks panel; tidak ada baris tabel yang tertangkap dalam tampilan apa pun.]

## Suggested checkpoints
1. After Phase 1: the rule engine is complete and fully unit/property tested, with no I/O.
2. After Phase 3: the core guarantees hold at the service level: fail-closed, atomic, audited, idempotent.
3. After Phase 5: the complete API contract is exercised via HTTP.
4. After Phase 7: the themed UI is feature-complete; visual QA runs in 8.3.
5. Phase 8: public demo deployed.
