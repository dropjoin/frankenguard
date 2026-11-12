# Competitor scan: Kiroween 2026, Frankenstein

Checked 2026-11-12 via public search (Devpost pages, dev.to build logs,
GitHub). The Devpost project gallery is not browsable without a session,
so this scan covers published entries and build logs found in the open.
No entry was copied; notes record what to beat.

## Published Frankenstein entries found

### GhostPR (AutoFix AI): the strongest entry found
- Devpost: https://devpost.com/software/ghostpr-autofix-ai
- Repo: https://github.com/Miladmet/ghost-pr
- What: screen recording + interaction markers in, Playwright repro test
  + defensive patch + verified GitHub PR out. Closed red-to-green loop,
  four systems welded (R2/QuickCast ingest, Playwright, patching,
  Octokit PRs). Built in Kiro Desktop IDE, spec-driven.
- What to beat: a genuinely closed loop with real artifacts (tests, PRs).
  Lesson: judges reward loops that produce evidence, not demos that
  describe loops. Frankenguard answers with a loop a judge can attack
  live: every verdict is an artifact in the ledger.

### FrankenAmp (A haunted Winamp revival)
- Devpost: https://devpost.com/software/a-haunted-winamp-revival
- What: resurrected Winamp UI, LLM agent stitches playlists and live
  visualizers, WebAudio + WebAssembly, Kiro agent hooks so the logic
  works from IDE and browser.
- What to beat: total commitment to one world (the Winamp UI *is* the
  app). Lesson: the page should recreate its subject's world, not
  describe it. Frankenguard answers with a console that *is* the guard,
  not a landing page about one.

### CodeVault
- Devpost: https://devpost.com/software/codevault-mc72o4
- What: forensic static analysis scanner, 15 OWASP rules, SHA-256
  tamper-evident audit chain, dashboard, spec in `.kiro/specs`.
- What to beat: it already ships a SHA-256 chain, so "hash-chained
  ledger" alone differentiates nothing. Frankenguard's edge must be the
  live decision loop + gate trace + adversarial simulator, not the
  chain. The chain is table stakes; the loop is the entry.

### GitBridge AI
- Devpost: https://devpost.com/software/gitbridge-ai
- What: GitHub webhook telemetry translated into human-readable Slack
  notifications. Kiro spec-driven, custom agents, steering docs.
- What to beat: a clean, narrow automation with compliant `/.kiro`.
  Lesson: narrow + working beats broad + promised.

### Free-Mint Triage
- Devpost: https://devpost.com/software/free-mint-triage
- Repo: https://github.com/pikyoe/free-mint-triage
- What: paste a contract address, get a verdict from two RPC nodes,
  GoPlus, and Sourcify. Read-only, one day from first login to
  submitted, 67-second demo video, `KIRO-USAGE.md` records the split.
- What to beat: speed-to-submitted and a brutally honest usage record.
  Lesson: the Kiro-usage write-up is judged; honest splits beat
  inflated claims.

### Server Familiar (in progress at scan time)
- Repo: https://github.com/vhmns14/server-familiar
- What: every server as a living creature stitched from real metrics.
  Phase 1 skeleton, `.kiro/specs/phase-1-skeleton/tasks.md`.
- Note: strong concept, unfinished at scan time. A finished entry beats
  a better concept that never ships.

### Franki (build log, by a prior Kiro hackathon winner)
- Build log: https://dev.to/mateo_cocco_6905648eea0d2/my-first-kiro-app-was-a-winner-heres-how-im-building-a-monster-3ap9
- What: avatar-first assistant stitching inbox, calendar, meals, money.
  Author won the Code with Kiro Hackathon with Denarii.
- Note: experienced Kiro builder, monster framing, daily build log.
  Treat as a serious contender for presentation.

## Adjacent bar-setter (Resurrection, but relevant)

### Signal Box / LeverFrame
- Devpost: https://devpost.com/software/kiroween-signal-box
- What: 1856 Victorian interlocking frame resurrected as a deterministic,
  MCP-enabled mutex tower for parallel agents. Tracked `/.kiro` EARS
  documents, executable unit + property tests, live MCP endpoint.
- What to beat: the Kiro-evidence bar. EARS specs + property tests +
  a live MCP server is the standard this entry sets. Frankenguard
  matches it: EARS requirements, five invariant properties over seeded
  random inputs, and a working MCP server in the repo.

## Gaps in the field (where Frankenguard can win)

1. **Attackability.** Most entries demo the happy path. Frankenguard
   invites the judge to break it: injection memos, amount tricks,
   unknown payees, freeze. The rogue simulator runs the attacks for
   them.
2. **Trace transparency.** Verdicts with evidence beat verdicts with
   scores. The six-gate trace shows every check, including passes.
3. **Honest limits.** Entries rarely state what does not work. The
   UTC-midnight edge, the deterministic parser, and the fictional
   vendors are stated on the page, in the README, and in the spec.
4. **Zero-dependency proof.** The full suite runs with Node stdlib only,
   and the build is deterministic bytes. A judge can verify everything
   in two commands.

## Rules verified from official sources (2026-11-12)

- Sponsor AWS, administrator Devpost. Submission period 30 Oct 2026
  9:00 am PT to 4 Dec 2026 2:00 pm PT. Judging 16 Dec 2026 to 29 Jan
  2027. Winners on or around 3 Feb 2027.
- "Insufficient use of Kiro will result in disqualification at the
  Judges' sole discretion." The `/.kiro` evidence and the Kiro write-up
  are not optional garnish.
- Indonesia is eligible (per the 4 Nov update: "Indonesia is now
  eligible", official rules updated).
- Projects must be new, created during the submission period.
