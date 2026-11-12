# Kiroween 2026 research: rules, rivals, Kiro docs, criteria map

Researched 2026-11-12. Research phase only. No application code was written
or changed in this run, and the existing drafts under this repo were left
untouched. Section 5 lists every correction the build phase must apply
before anything ships. Every factual claim below carries its source.
Where a source could not be verified, that is stated, not smoothed over.

Identity rule for everything in this repo: organizer-facing text uses only
Devpost username dropjoin, name M Aziz Yahya, email dropjoin0@gmail.com.
The Kiro session account holding the bonus credits must never appear in
repo files, the README, or submission text.

## 0. Findings that change the build

Read this section first. Each item is a verified fact that invalidates
something already drafted or assumed. The build phase starts by fixing
these, not by adding features.

1. The two hook drafts use a made-up schema. The real Kiro hook format
   since IDE 1.0 / CLI V3 is a v1 JSON envelope with PascalCase triggers,
   and there is no `preCommit` trigger in Kiro at all. Both files must be
   rewritten. See sections 4.3 and 5.
2. The three steering drafts have no frontmatter. `always` is the
   default, so they are not broken, but they show no inclusion strategy,
   and the rules explicitly ask what steering strategy made the biggest
   difference. Frontmatter plus one fileMatch-scoped file is required.
3. The custom agent draft is in the valid Markdown format, but it is
   missing `resources`, so per the docs it would load no steering
   context at all. Its tool selectors lack the `@server/tool` form, and
   `model: default` is not a documented value. See section 5.
4. Hooks do not run in Kiro Web. Web sessions store hook configuration
   for later local use but do not execute triggers. The write-up must
   never claim hooks fired during the Kiro Web spec session. Hooks are
   stored config that runs in the IDE and CLI.
5. Kiro's linked property-based testing is IDE-only. Property tests
   written any other way are ordinary tests. Our invariant tests must be
   described as property-style tests over seeded random inputs, never
   as Kiro PBT output.
6. The dark violet UI already drafted violates the user's UI rule. No
   all-dark default. The design must be rebuilt bright, vivid, and
   themed. See section 7. Do not ship the dark design.
7. One rival (NecroSpec, section 3) has a README that claims `.kiro`
   files its own tree does not contain, plus hardcoded judge credentials
   in the README. That is the exact failure mode the pre-submission
   audit in section 8 exists to prevent in our repo.
8. The Devpost gallery is not browsable without a session, so this
   research cannot see every entry. The gallery must be re-scanned from
   a logged-in session before submission. Section 3 records exactly
   what was and was not covered.

## 1. Official rules, deep read

Source: https://kiroween.devpost.com/rules, all 619 lines read
2026-11-12. Sponsor Amazon Web Services. Administrator Devpost, Inc.

### 1.1 Dates

- Registration: 13 Oct 2026 8:30 am PT to 4 Dec 2026 2:00 pm PT.
- Submission: 30 Oct 2026 9:00 am PT to 4 Dec 2026 2:00 pm PT.
  That is 5 Dec 2026 05:00 WIB. No extensions. Late submissions are
  not accepted.
- Judging: 16 Dec 2026 1:00 pm PT to 29 Jan 2027 1:00 pm PT.
- Winners announced on or around 3 Feb 2027 9:00 am PT.
- Credit requests: due 1 Dec 2026 12:00 pm PT. Redeemed credits expire
  31 Dec 2026 11:59 pm PT. (Credits are already redeemed; noted only
  for completeness.)
- Once the submission period has begun, no material changes to judging
  criteria, eligibility, or prize structure without notification to all
  registered participants (section 11).

### 1.2 Eligibility

Open to individuals of the age of majority, teams of at most 3, and
organizations. The exclusion list in section 3 names Quebec, Argentina,
Australia, Brazil, Italy, Philippines, Russia, Cuba, Iran, North Korea,
Syria, Belarus, Crimea, DNR, LNR, the UAE, and comprehensively
sanctioned countries. Indonesia does not appear in that list as read
2026-11-12. Employees and agents of the sponsor and administrator,
judges, and their families and affiliates are excluded.

### 1.3 What to create

"Entrants must build a working software application using Kiro (IDE,
CLI, Web, and/or Kiro Crew) and submit it into one of the following
categories. Insufficient use of Kiro will result in disqualification at
the Judges' sole discretion."

Categories, verbatim:

- Resurrection: "Bring your favorite dead technology back to life.
  Reimagine obsolete tech with today's innovations or solving
  tomorrow's problems."
- Frankenstein: "Stitch together a chimera of technologies into one
  app. Bring together seemingly incompatible elements to build
  something unexpectedly powerful."
- Skeleton Crew: "Build a skeleton code template lean enough to be
  clear but flexible enough to support various use cases. Show us its
  versatility with two distinct applications from your foundation."
- Costume Contest: "Build any app but show us a haunting user
  interface that's polished and unforgettable. Bring in spooky design
  elements that enhance your app's function."

Frankenguard enters Frankenstein. The category definition is the
brief: the submission must name the incompatible elements stitched
together and show why the combination is unexpectedly powerful. A
single-technology app, however polished, does not fit the category
text.

Other project requirements:

- The project must install and run consistently on its intended
  platform and function as depicted in the video and text.
- New projects only: created after the submission period started.
  Standard frameworks, libraries, and starter templates are allowed,
  but any other pre-existing code or work incorporated must be
  disclosed. The work submitted must have been built during the
  submission period.
- Third-party SDKs, APIs, and data require authorization under their
  terms.
- The project must not have been developed with financial or
  preferential support from the sponsor or administrator.

### 1.4 Submission requirements

- URL to the functional application. If login is needed, credentials
  and instructions go in the submission form. Frankenguard needs no
  login, which removes a whole failure mode.
- Text description of features and functionality.
- Demonstration video: under 3 minutes (judges are not required to
  watch beyond 3 minutes), footage of the project functioning on its
  intended device, uploaded to YouTube and publicly visible, no
  third-party trademarks or copyrighted music or material without
  permission.
- Public GitHub repository URL (NOT GitLab or BitBucket). The repo must
  contain all source, assets, and instructions to run the project, be
  public and open source with a license file detectable and visible at
  the top of the repository page in the About section. The repo must
  contain `/.kiro` at the root showing usage such as specs, hooks, and
  steering. Do NOT add `/.kiro` or sub-folders to `.gitignore`; that
  could disqualify the submission.
- Identify the category and bonus categories.
- The project must be available free of charge and without restriction
  for testing, evaluation, and use by the sponsor, administrator, and
  judges until the judging period ends (29 Jan 2027). Failure to
  provide access when requested may result in disqualification.
- All submission materials must be in English or carry an English
  translation.
- Critical sentence for strategy: "Judges are not required to test the
  Project and may choose to judge based solely on the text description,
  images, and video provided in the Submission." The write-up, the
  screenshots, and the video must carry the entry on their own. A
  brilliant demo that only reveals itself after ten clicks is a
  scoring risk.

### 1.5 The Kiro write-up: eight prompts the judges are told to look for

The rules require "a write up on how Kiro was used" and list the
exact questions. The submission must answer all eight, with specifics,
not adjectives:

1. Kiro IDE, CLI, Web, Crew: how did they differ, if multiple were tried?
2. Custom agents: created or used any? Which Kiro app? How did they
   impact the build?
3. Agent hooks: what specific workflows were automated? How did the
   hooks improve the development process?
4. Spec-driven development: how was the spec structured for Kiro to
   implement? How did the approach improve the process? How did it
   compare to vibe coding?
5. Steering docs: how did steering improve Kiro's responses? What
   particular strategy made the biggest difference?
6. MCP: how did extending Kiro's capabilities help? What features or
   workflow improvements did MCP enable that would otherwise have been
   difficult or impossible?
7. Property-based testing: did PBT catch issues unit tests might have
   missed? What kind of requirements was PBT enabled for?
8. Kiro powers: which powers were leveraged for bundled best practices
   and expertise? Any third-party tooling or integrations that would
   not have been used otherwise?

Honesty constraints on each answer are in section 4. In particular:
powers are environment artifacts, not repo artifacts, and hooks do not
execute on Web. Any write-up sentence that implies otherwise is a
false claim a Kiro-fluent judge will catch.

### 1.6 Judging: two stages, five criteria, 10 points each

Stage One is pass/fail: the idea meets a baseline level of viability,
reasonably fits the theme, and reasonably applies the required tools.
Stage Two scores all passing submissions on five equally weighted
criteria, 10 points each. Verbatim:

- Potential Impact (20%, 10 points): "Does the project make a
  credible case for solving a real problem for a real audience? Does
  the solution address that problem based on what's demonstrated? How
  useful, intuitive, and accessible is it? Would someone actually use
  this?"
- Technological Implementation (20%, 10 points): "How thoroughly and
  skillfully does the project use Kiro? Was there a thoughtful
  strategy to AI development? Was a variety of Kiro tools used
  impactfully? Does the project show a deep understanding of Kiro
  features? Was there experimentation?"
- Design (20%, 10 points): "Does the project deliver a complete,
  coherent product experience, not just a technical proof of concept?
  Is the design intuitive, polished, and intentional?"
- Innovation/Idea (20%, 10 points): "How creative and novel is the
  concept, and does the project differ from existing concepts? Are any
  unusual technologies or public resources (like datasets) leveraged
  or combined in a unique way?"
- Presentation (20%, 10 points): "Does the video clearly demonstrate
  the project working end-to-end? Does the pitch communicate what
  problem is solved, who it's for, and why it matters? Is the overall
  presentation easy to follow? Is the presentation creative and
  memorable?"

Tie-breaking: tied submissions are re-evaluated from scratch at a
20-point maximum per criterion, then +10 per round until a winner
emerges. Judging may use expert panels, peer review, automated
AI-driven analysis, or any combination. Judges may change before or
during judging. Section 6 maps each criterion to concrete features
and evidence.

### 1.7 Prizes

- Overall: 1st $30,000, 2nd $20,000, 3rd $10,000. One winner each.
- Category: Best Resurrection, Best Frankenstein, Best Skeleton Crew,
  Best Costume Contest, $5,000 each.
- Bonus: Best Startup Project $10,000 (requires founder confirmation,
  LinkedIn, startup website); Best Ghost of Kiroween Past $2,000
  (requires verified 2025 registration); Best Kiro Crew App $1,000
  (separate repo, same GitHub account, judged by the Kiro team from
  the top 50 eligible submissions); Best Student Project, one per
  category, 1-year Kiro Pro Max subscription valued at $1,500
  (requires enrollment proof); Best Demo $1,000 (highest Presentation
  score among submissions in the top 10% overall); Blog Post Bonus,
  2,000 bonus Kiro credits, 100 winners (public blog post about Kiro
  published during the submission period, must mention Kiroween
  Hackathon 2026); Social Blitz, 3-month Kiro Pro+ subscription, 5
  winners (public post starting with the hashtag #KiroweenHackathon26
  before any other content, favorite thing about Kiro plus how it
  changed the entrant's approach; judged on original thought vs AI
  writing, insight, and asset quality).
- Multiple-prize rule: a project can win one Overall prize OR one
  Category prize AND any number of Bonus prizes.
- Bonus prizes realistically in reach for this entry: Best Demo, Blog
  Post, Social Blitz. Startup, Student, and Ghost of Kiroween Past do
  not apply (no startup profile is claimed, no student enrollment is
  claimed, no 2025 registration exists). Kiro Crew App would need a
  second repo and is out of scope unless the parent orders it.
- Verification: prizes are subject to verification of identity,
  qualifications, and role in creating the submission, plus prize
  affidavits. Required forms are due within 10 business days of being
  sent. Prizes are delivered within 60 days of receipt of completed
  forms. Winners handle their own taxes and fees; US residents may
  need form W-9, residents of other countries form W-8BEN. The
  sponsor may withhold for tax compliance.
- IP: submissions remain the entrant's property. The sponsor gets a
  fully paid, non-exclusive license to use the entry for judging, and
  the sponsor and Devpost may promote the submission and use the
  entrant's name, likeness, voice, and image for three years after the
  submission period. Submissions must be original, solely owned, and
  non-infringing. Third-party technical assistance is allowed provided
  the components are solely the entrant's work product and the result
  of the entrant's ideas and creativity, and the entrant owns all
  rights.
- Disputes: individual binding arbitration under American Arbitration
  Association rules, governed by New York law, no class actions, no
  punitive or consequential damages beyond out-of-pocket expenses.

## 2. What wins: Kiroween 2025 patterns

Sources: https://kiroween-2025.devpost.com/ (full page read
2026-11-12), https://kiro.dev/blog/kiroween-2025/, and the winning
repo below via GitHub API.

- 2025 was the first Kiroween: 31 Oct to 5 Dec 2025, $100,000 across
  12 prizes and 66 winners, about 4,958 participants (Devpost
  portfolio pages). Same four categories, same $30,000/$20,000/$10,000
  overall prizes, same $5,000 category prizes.
- 2025 judging used three criteria: Potential Value, Implementation
  (how well the idea leverages Kiro), Quality and Design. The 2026
  rules split these into five, adding explicit Design and Presentation
  criteria and an explicit Innovation criterion. The bar moved: a
  strong implementation alone no longer covers presentation.
- 2025 judges were named on the page: 12 people including Kiro's own
  Senior Developer Advocate (Erik Hanchett), a Principal UX Designer
  for AWS Agentic AI / Kiro (Phill Shaffer), a Senior Solutions
  Architect for Kiro (Jay Raval), plus analysts and creators. Lesson:
  the panel includes people who build Kiro and people who judge UX for
  a living. Fake `.kiro` artifacts and sloppy UI are both judged by
  specialists.
- 2025 write-up prompts already demanded specifics on vibe coding,
  hooks, specs, steering, and MCP. 2026 adds custom agents, PBT,
  powers, and multi-surface comparison. Entries that only show specs
  and steering are now baseline, not differentiators.
- 2025 Grand Prize winner, per the repo's own description: Kiro
  InteractionKit by Harpita-P (https://github.com/Harpita-P/Kiro-InteractionKit,
  20 stars, last pushed 5 Dec 2025). A starter-friendly template that
  turns MediaPipe hand, face, and head tracking into simple controls
  for games and creative apps, with two featured applications
  (Math-O-Lantern, a hand-controlled pumpkin-slicing math game, and
  Holo-Board, a lightboard tool for videos). The README leads with a
  banner image, animated GIFs of both apps working, and a plain
  "what can you build" pitch. Winning pattern: reusable foundation
  plus two working proofs plus visual evidence in the README itself.
  Judges see the thing move before they read a word of architecture.
- 2025 promo identity (official Kiro Instagram post, 31 Oct 2025):
  purple lighting, pumpkins, jack-o-lantern, disco ball, floating
  purple ghost, Frankenstein-style character, skeletons, a
  spider-legged ghost, "Ready to code in the dark?" The Kiroween
  visual language is purple plus Halloween props, playful, not horror.
  Section 7 builds on this.

## 3. Kiroween 2026 gallery, entry by entry

Coverage, stated honestly. The Devpost project gallery is not
browsable without a session, so no claim is made that this is every
entry. What was inspected, 2026-11-12:

- 8 published Devpost entries found through public search, one read
  in full (Signal Box).
- 13 GitHub repositories found through GitHub code search for
  "kiroween" created in the submission period, inspected through the
  GitHub API: metadata, full file trees, README text.
- 2 build logs / in-progress repos from the earlier 12 Nov scan.
- 5 further repos found in the same search were empty shells or a
  lone README (DunsinK/Kiroween2026, elhamnazif/kiroween26,
  plat16022005/kiroween2026, timmyspurs12/kiroween,
  victrvondoom/Kiroween). They are not threats today, but they were
  created 3-11 Nov and could still fill up. Re-scan before submission.

### 3.1 Published Devpost entries

#### GhostPR (AutoFix AI): the strongest Frankenstein entry found

- Devpost: https://devpost.com/software/ghostpr-autofix-ai
- Repo: https://github.com/Miladmet/ghost-pr
- What: screen recording plus interaction markers in, Playwright
  reproduction test plus defensive patch plus verified GitHub PR out.
  Four systems welded: ingest, Playwright, patching, Octokit PRs.
  Built in the Kiro Desktop IDE, spec-driven.
- Strengths: a genuinely closed loop that produces real artifacts
  (tests, PRs). The demo does not describe a loop, it runs one.
- Weaknesses: the loop depends on external services (recording ingest,
  GitHub), so a judge cannot run the whole thing from the repo alone
  without accounts and tokens.
- Beat plan: Frankenguard's loop must be attackable live by a judge
  with zero setup. Every verdict is an artifact in the ledger, and the
  rogue simulator runs the attacks for the judge. No accounts, no
  tokens, no backend. The loop closes in the browser, in seconds.

#### FrankenAmp: a haunted Winamp revival

- Devpost: https://devpost.com/software/a-haunted-winamp-revival
- What: resurrected Winamp UI, LLM agent stitches playlists and live
  visualizers, WebAudio plus WebAssembly, Kiro agent hooks so the
  logic works from IDE and browser.
- Strengths: total commitment to one world. The Winamp UI is the app,
  not a skin on a form. Memorable in a way a dashboard never is.
- Weaknesses: nostalgia-first. The problem it solves is thin compared
  with the craft, which caps Potential Impact.
- Beat plan: steal the world-commitment, not the nostalgia. The
  Frankenguard page must be the guard's own console, not a landing
  page describing a guard. The monster-mashup motif (stitched seams,
  bolts, mismatched parts) must be visible in the UI itself.

#### CodeVault

- Devpost: https://devpost.com/software/codevault-mc72o4
- What: forensic static analysis scanner, 15 OWASP rules, SHA-256
  tamper-evident audit chain, dashboard, spec in `.kiro/specs`.
- Strengths: real analysis depth, and it already ships a SHA-256
  audit chain.
- Weaknesses: a scanner dashboard is a familiar shape. The chain is a
  feature, not the product.
- Beat plan: the hash chain alone differentiates nothing. CodeVault
  proves that. Frankenguard's edge must be the live decision loop,
  the six-gate trace, and the adversarial simulator. The chain is
  table stakes. The loop is the entry.

#### GitBridge AI

- Devpost: https://devpost.com/software/gitbridge-ai
- What: GitHub webhook telemetry translated into human-readable Slack
  notifications. Kiro spec-driven, custom agents, steering docs.
- Strengths: clean, narrow, working. Compliant `/.kiro`. Narrow plus
  working beats broad plus promised.
- Weaknesses: narrow scope and a Slack dependency limit both impact
  and judge testability.
- Beat plan: match the narrowness (one job, done completely) while
  beating the testability (no Slack, no webhooks, runs anywhere).

#### Free-Mint Triage

- Devpost: https://devpost.com/software/free-mint-triage
- Repo: https://github.com/pikyoe/free-mint-triage
- What: paste a contract address, get a verdict from two RPC nodes,
  GoPlus, and Sourcify. Read-only. One day from first login to
  submitted. 67-second demo video. `KIRO-USAGE.md` records the split
  of what Kiro did.
- Strengths: speed to submitted, and a brutally honest Kiro-usage
  record. The 67-second video respects the judges' time.
- Weaknesses: a read-only verdict tool with four external
  dependencies. If any API is down, the demo degrades.
- Beat plan: match the honesty of the usage record and the short
  video. Beat the fragility: zero external dependencies at runtime.

#### Signal Box: the Kiro-evidence bar (Resurrection)

- Devpost: https://devpost.com/software/kiroween-signal-box, full
  page read 2026-11-12. Published 3 Nov 2026.
- What: 1856 Victorian mechanical interlocking resurrected as a
  deterministic, MCP-enabled mutex tower for parallel AI agents.
  Eight levers, four routes, a safety oracle independent of the
  locking table, a fast-check PBT Exorcist, a live MCP endpoint on
  Vercel, a static mirror, a launch film, a DEV.to blog post, and an
  X post with the required hashtag.
- Strengths, all verified from the Devpost page: tracked `.kiro` EARS
  requirements, design, and verified task status; four steering
  files; two hook definitions (save-time test hook, agent-stop PBT
  hook); PBT with a named seed (20261031), exact counts from the
  11 Nov verification run (80 safe sequences, 461 step checks, faulty
  table failed on run 3, counterexample shrunk from 11 actions to 3);
  MCP over JSON-RPC 2.0 through the official MCP SDK with four tools;
  `npm test` 23 tests green, `tsc`, build, and `npm audit` zero
  vulnerabilities all dated 11 Nov; honest limits stated in plain
  text (self-declared agent IDs are not authentication, browser and
  HTTP stores are separate, cold starts reset state, no distributed
  locking, does not coordinate real production deployments).
- Weaknesses: Resurrection, not Frankenstein, so it does not compete
  for the category prize. The MCP endpoint's state resets on cold
  starts and instances do not share locks, which the author discloses.
  The stack (Next.js server mode on Vercel) is heavier than the demo
  needs.
- Beat plan: match the evidence standard exactly (named seeds, exact
  counts, dated verification runs, honest limits in the submission
  text), and beat it on the Frankenstein axis: five incompatible
  elements stitched into one artifact, a working MCP server in the
  repo, and a demo with no server state to reset. Signal Box sets the
  bar for how a submission should read. Frankenguard must read at
  least that well.

#### Franki (build log, by a prior Kiro winner)

- Build log: https://dev.to/mateo_cocco_6905648eea0d2/my-first-kiro-app-was-a-winner-heres-how-im-building-a-monster-3ap9
- What: avatar-first assistant stitching inbox, calendar, meals,
  money. The author won the Code with Kiro Hackathon with Denarii
  and is publishing a daily build log.
- Strengths: an experienced Kiro builder who knows the judging game,
  monster framing, public build narrative.
- Weaknesses: breadth (inbox plus calendar plus meals plus money) is
  the classic hackathon trap. A daily log is not a shipped demo.
- Beat plan: ship finished and narrow. A finished entry beats a
  better concept that never lands.

#### Server Familiar (in progress at scan time)

- Repo: https://github.com/vhmns14/server-familiar
- What: every server as a living creature stitched from real metrics.
  Phase 1 skeleton with `.kiro/specs/phase-1-skeleton/tasks.md`.
- Strengths: strong concept, Frankenstein-shaped.
- Weaknesses: unfinished at scan time.
- Beat plan: none needed beyond finishing. Note the pattern: several
  strong concepts in this field are unfinished. Finishing is itself
  a differentiator.

### 3.2 GitHub repos inspected via API

#### Skeleton Key: the overall-prize bar (Skeleton Crew)

- Repo: https://github.com/charonmaseka-cell/skeleton-key-kiroween2026
  (TypeScript, MIT, 13.9 MB, pushed 7 Nov 2026).
- What: one document-checking engine, two haunted apps (ScopeCheck
  for supplier quotations, PackCheck for grant packs), both live on
  Cloudflare Pages. A language model only reads documents; plain code
  decides what counts as a finding. Four specs, six steering files,
  two hooks, a CI workflow, golden fixtures, replayed samples, a
  "Lights on" mode, reduced-motion support, and a priced shared daily
  allowance for live AI analysis.
- Strengths: the strongest overall entry found. Two live demos, real
  AI integration with honest cost handling, the same "model reads,
  code decides" philosophy as Frankenguard executed at larger scale,
  meticulous README with a 30-second trial path, and epistemic care
  ("not evaluated" is never presented as "no difference"). The live
  ScopeCheck page was fetched 2026-11-12 and shows real computed
  comparisons with cited source lines.
- Weaknesses: Skeleton Crew, not Frankenstein. Live analysis depends
  on a shared daily allowance and can be refused when the budget is
  spent. The architecture is large for a judge to verify end to end.
- Beat plan: do not fight Skeleton Key on scale. Beat it on the
  Frankenstein definition (five incompatible elements, one artifact),
  on the money domain (higher stakes, clearer real-world problem than
  document checking), on the hash-chained tamper-evident ledger with
  a tamper demo, on the MCP server that lets other agents use the
  guardrail, and on zero-backend instant verification: no allowance,
  no budget, no refusal, works offline after load.

#### Albedian: the ambition bar, direct Frankenstein rival

- Repo: https://github.com/glendonC/albedian (Python, MIT, 238 MB,
  pushed 12 Nov 2026, still active).
- What: observation-centered media restoration and 3D spatial
  astronomy instrument. Turns a night-sky photo into a calibrated 3D
  portal across five regimes, with star catalog matching, voice
  actions, WebGL2 ray-marching, and a four-class evidence system
  (observed, catalog_matched, predicted, simulated) with explicit
  epistemic boundaries. Twelve specs, five steering files (including
  design-motion with frontmatter and a fileMatch pattern), two custom
  agent files, five hook files, and a README that cites peer-reviewed
  research (Falchi 2016, Kyba 2023, Hasinoff 2016) and states open
  gaps honestly.
- Strengths: enormous scope executed with scientific discipline. The
  evidence-classification system is the most intellectually serious
  idea in the field. The README is a thesis with citations.
- Weaknesses: 238 MB is a liability for judge verification. The hooks
  use the legacy `.kiro.hook` format, which the current docs mark
  legacy. Scope this large risks a demo that shows breadth instead of
  a working end-to-end path. Several README claims carry "[open]"
  markers, meaning known-unfinished pieces are disclosed.
- Beat plan: beat it on verifiability and finish. Frankenguard's repo
  must be small, its test suite must run in seconds with zero
  dependencies, its hooks must use the current v1 JSON format, and
  its demo must complete end to end in under a minute. Albedian wins
  on ambition; Frankenguard wins on "I ran it myself and it all
  worked."

#### Phantom Inbox: the accessibility and dual-view bar

- Repo: https://github.com/VRCHAMPION/kiroween (TypeScript, MIT,
  9 MB, pushed 11 Nov 2026).
- What: scam detector for emails, SMS, and WhatsApp messages, built
  for non-technical adults and elderly parents, focused on scams
  common in India. Possession Check, Exorcism next steps, and a
  10-round Séance training game. Seven specs (with `.config.kiro`
  and `tasks.meta.json` metadata files, the signature of real Kiro
  IDE usage), five hooks, five steering files, MCP config, and a
  design-system steering file.
- Strengths: the best audience definition in the field (elderly
  parents, named scam types, Hindi plus English output), the best
  dual-view design (calm high-contrast Mortal view by default, Haunted
  view as an opt-in layer, WCAG AA contrast in both, reduced-motion
  parity), on-device OCR with tesseract.js, and a privacy promise
  with no backend and no storage.
- Weaknesses: category not stated in the README. Detection is
  keyword-and-rule based, which is honest but shallow next to a
  learned model. The haunted effects are decoration on a form.
- Beat plan: steal the dual-view pattern outright (bright, calm,
  high-contrast default; theme as an opt-in layer; WCAG AA both
  ways). Beat it on depth of the decision path: Frankenguard's six
  gates with traces and a tamper-evident ledger are a deeper
  mechanism than keyword flags, and the attack simulator proves it
  live.

#### dustin-lap1 skeleton: the Skeleton Crew depth bar

- Repo: https://github.com/dustin-lap1/kiroween (JavaScript, MIT,
  pushed 4 Nov 2026, untouched since).
- What: AWS serverless app skeleton with a guarded pipeline, three
  specs, eleven steering files, three v1 JSON hooks, two apps
  (Candy Stash, Ghost Guestbook) in separate folders, Terraform with
  per-account state, SCPs, budget alarms, React 19 plus Vite plus
  Tailwind 4, config-driven CRUD API.
- Strengths: the most complete `.kiro` evidence in the field by file
  count, and a genuinely opinionated pipeline (own AWS account per
  app, guardrails before deploy).
- Weaknesses: Skeleton Crew, not Frankenstein. No live demo URLs in
  the README head; a judge needs AWS accounts to run anything. No
  commits since 4 Nov, eight days before this research, which reads
  as abandoned or finished-early.
- Beat plan: beat it on judge testability. Frankenguard needs no
  cloud account, no Terraform, no deploy. The demo URL works for
  anyone, and the repo verifies in two commands.

#### mukeshkbj mainframe seance: deep Kiro evidence, unclear category

- Repo: https://github.com/mukeshkbj/Kiroween26 (Python, MIT, 5.6 MB,
  pushed 10 Nov 2026).
- What: a mainframe/legacy "seance" system with a screen bridge, an
  MCP server, a spirit map, and a seance agent. Six specs, six
  steering files (including `judging.md` and `mcp-safety-review.md`),
  three hooks, MCP config.
- Strengths: thorough Kiro evidence, and a steering file aimed at
  judging shows the author is thinking about scoring.
- Weaknesses: the concept is hard to grasp from the repo structure
  alone, and the category is not confirmed. Legacy-mainframe
  resurrection themes suggest Resurrection, not Frankenstein.
- Beat plan: clarity. Frankenguard's concept must be understood in
  one sentence, and the demo must prove it in 30 seconds.

#### DarkerMinecraft senior-call-shield: real problem, real Kiro usage

- Repo: https://github.com/DarkerMinecraft/Kiroween2026 (TypeScript,
  MIT, pushed 9 Nov 2026).
- What: call protection for seniors, built on SignalWire. Two specs,
  one of them a genuine Bugfix Spec with `bugfix.md` plus
  `tasks.meta.json` and `.config.kiro` metadata, one hook, MCP config,
  two steering files.
- Strengths: a real problem for a real audience, and the Bugfix Spec
  with Kiro-generated metadata is evidence of genuine Kiro IDE use,
  not hand-written artifacts.
- Weaknesses: depends on SignalWire telephony, which a judge cannot
  easily test. Small `.kiro` footprint otherwise.
- Beat plan: same lesson as GhostPR and GitBridge. Real problem,
  zero-dependency demo. Frankenguard's judge can test everything
  without a phone, an account, or a key.

#### azrelazyzz music cataloguing: tidy, small, forgettable

- Repo: https://github.com/azrelazyzz/Kiroween2026-Music (TypeScript,
  MIT, pushed 11 Nov 2026).
- What: music cataloguing MVP. One spec, seven steering files, one
  hook plus a hook script.
- Strengths: tidy steering coverage, including AI-reliability and
  privacy-security files.
- Weaknesses: one spec, a commonplace idea, no visible differentiator.
- Beat plan: no specific action. This is the baseline a serious entry
  clears by existing.

#### NecroSpec Studio (civkiro): the cautionary tale

- Repo: https://github.com/LMH-gh/civkiro-1991-kiroween2026 (HTML,
  MIT, pushed 3 Nov 2026).
- What: README claims a spec-driven development workbench and
  Skeleton Crew starter template with a full `.kiro` architecture,
  judge login credentials, GitHub Pages deployment, and PBT.
- Strengths: none verified. The concept (a workbench that validates
  `.kiro` specs) is meta-clever.
- Weaknesses, all verified from the repo tree via API: the tree
  contains only one spec folder with only `requirements.md`, one
  steering file (`product.md`), and one hook. The README claims
  `design.md`, `tasks.md`, `tech.md`, `structure.md`, a second hook,
  and an MCP config that do not exist. The README publishes
  hardcoded judge credentials (`judge@kiroween.dev` and a password in
  plaintext). One test file, one HTML file, a `SUBMITTED.md` marker.
- Beat plan: this entry is the reason for section 8. Every README
  claim in Frankenguard must be mechanically checked against the
  tree before submission. No credentials of any kind in any file.

### 3.3 Ranked threats and the field's gaps

Ranked by combined evidence quality, finish, and category overlap:

1. Skeleton Key (overall bar, Skeleton Crew).
2. Signal Box (evidence and honesty bar, Resurrection).
3. Albedian (ambition bar, Frankenstein, direct rival).
4. GhostPR (closed-loop bar, Frankenstein, direct rival).
5. Phantom Inbox (audience and accessibility bar).
6. dustin-lap1 skeleton (Kiro-evidence depth bar, Skeleton Crew).
7. FrankenAmp, CodeVault, GitBridge AI, Free-Mint Triage (published,
   real, beatable on the axes in their sections).
8. mukeshkbj, DarkerMinecraft, azrelazyzz, Franki, Server Familiar
   (credible but unfinished, unclear, or narrow).
9. NecroSpec and the five empty shells (not threats; NecroSpec is a
   warning).

Gaps in the field where Frankenguard can win, each verified against
the entries above:

1. Attackability. Most entries demo the happy path. None invites the
   judge to break the product live. Frankenguard's rogue simulator
   and injection-memo handling do.
2. Trace transparency. Verdicts with evidence beat verdicts with
   scores. The six-gate trace shows every check, including passes.
   Only Signal Box matches this standard, in a different category.
3. Honest limits stated in the submission text. Signal Box and
   Albedian do this well. Most entries do not state limits at all.
4. Zero-dependency verification. The full suite must run with Node
   stdlib only, and the build must be deterministic bytes. A judge
   verifies everything in two commands. No rival with a backend,
   an allowance, or a cloud account can match that.
5. Bright, themed, accessible UI. The field's UIs skew dark and
   atmospheric (Skeleton Key's default is a seance, Phantom Inbox's
   haunted view is a mansion at night, Albedian is a night sky).
   A bright, vivid, WCAG AA interface that still reads as Kiroween
   stands out immediately. See section 7.

## 4. Official Kiro documentation, verified

All pages below were read from kiro.dev/docs or AWS-published Kiro
material on 2026-11-12. Where a secondary source is cited, it is
labeled secondary. Doc versions matter: hooks changed format in IDE
1.0 / CLI V3, and several older blog posts still show the legacy
format. The legacy format is wrong for this submission.

### 4.1 Spec-driven development

Sources: https://kiro.dev/docs/specs/ (updated 15 Oct 2026),
https://kiro.dev/docs/specs/best-practices/,
https://kiro.dev/docs/getting-started/first-project/ (updated 21 Oct
2026), https://kiro.dev/docs/custom-agents/built-in/ (updated 3 Nov
2026), AWS "Kiro: Zero to Hero 05" deck (Speaker Deck, Riku Inada,
AWS Japan, updated 1 day before this research).

- A spec is three Markdown files in `.kiro/specs/<kebab-case-name>/`:
  `requirements.md`, `design.md`, `tasks.md`. Bugfix specs replace
  `requirements.md` with `bugfix.md` (current behavior, expected
  behavior, unchanged behavior). Feature specs and bugfix specs are
  available in the IDE, CLI, and Web. Quick Spec generates all three
  phases in one pass without approval gates.
- Requirements phase: user stories with acceptance criteria in EARS
  notation (Easy Approach to Requirements Syntax). One behavior per
  sentence: "WHEN [condition] THE SYSTEM SHALL [expected behavior]."
  The EARS structure is what makes requirements machine-checkable
  later.
- Design phase: technical architecture, components, data models,
  sequence diagrams, error handling, testing strategy. Correctness
  properties are derived from the acceptance criteria during design
  (see 4.7).
- Tasks phase: discrete, trackable implementation tasks. Each task
  lists the requirements it meets (the AWS deck shows the convention
  `_Requirements: 1.1_` under each task). Tasks can be run one at a
  time or all at once; Run all Tasks analyzes dependencies and runs
  independent tasks concurrently, but runs only required tasks by
  default.
- Approval gates: the Spec agent asks for approval at each phase
  (except Quick Spec). Requirements-first vs design-first is chosen
  when the spec is created and cannot be changed mid-spec; a
  different approach means a new spec. Design-first derives
  requirements from the design afterward, which suits strict
  non-functional constraints.
- Specs are designed to be version-controlled in the repo alongside
  the code. When requirements change, update `requirements.md`, ask
  Kiro to update `design.md`, then use Sync Files on `tasks.md` to
  generate tasks for the new requirements.
- Built-in agents: Spec, Quick Spec, and Bug Fix produce the formal
  documents in `.kiro/specs/` with approval gates between phases.

### 4.2 Steering docs

Source: https://kiro.dev/docs/steering/ (capability table and
inclusion section read 2026-11-12). Secondary confirmation:
https://www.memorylake.ai/en/blogs/split-kiro-steering-for-ide-and-cli,
https://troiana.net/guides/kiro/ (checked 4 Nov 2026).

- Steering gives Kiro persistent project knowledge through Markdown
  files. Workspace steering lives in `.kiro/steering/` at the project
  root and applies to that workspace only. Global steering lives in
  `~/.kiro/steering/` and applies to all workspaces. On conflict,
  workspace steering wins. On Web, the cloud sandbox cannot read
  `~/.kiro/steering/`; Configuration Sync is the documented route for
  reusing personal steering across cloud sessions.
- Kiro's Generate Steering Docs creates three foundation files:
  `product.md`, `tech.md`, `structure.md`. These are included in
  every interaction by default.
- Inclusion modes are configured with YAML frontmatter that must be
  the first content in the file: no blank lines or other content
  before the opening `---`. Four modes:
  - `inclusion: always`: loaded in every interaction. The default.
    Use for core standards: stack, conventions, architecture.
  - `inclusion: fileMatch` plus `fileMatchPattern`: loaded only when
    working with files matching the glob. The pattern accepts a
    single glob string or an array of globs. Example from the docs:
    `fileMatchPattern: "components/**/*.tsx"`.
  - `inclusion: manual`: loaded only when the user pulls it in with
    `#file-name` in chat, or runs it as a `/<filename>` slash
    command.
  - `inclusion: auto`: Kiro decides from the file's `name` and
    description whether the request matches. Requires both fields.
- Inclusion-mode support varies by surface and version. The docs
  capability table marks inclusion modes available across IDE, CLI,
  Web, and Mobile, with CLI V3 full and V1/V2 partial. Older
  secondary sources state CLI 2.x loaded everything. State the
  version when claiming behavior; do not claim universal behavior.
- Custom agents do NOT automatically include steering files. The
  docs state this explicitly: "When using custom agents, steering
  files are not automatically included. You must explicitly add them
  to the agent's `resources` configuration to load steering context."
  A glob such as `file://.kiro/steering/**/*.md` in `resources` is
  the documented fix.
- `AGENTS.md` files are supported and do not support inclusion modes:
  they are always included.

### 4.3 Agent hooks

Sources: https://kiro.dev/docs/hooks/ (updated 21 Oct 2026, full
page read), https://kiro.dev/docs/hooks/types/ (updated 6 Nov 2026,
full page read), https://kiro.dev/docs/ide/whats-new-v1/hooks/
(updated 21 Aug 2026).

- Hooks run shell commands or agent prompts automatically when
  specific events happen: the agent modifies a file, invokes a tool,
  or completes a task. The developer defines the trigger and the
  action; Kiro handles execution.
- Current format, introduced in IDE 1.0 and CLI V3: standalone JSON
  files at `.kiro/hooks/<id>.json`, kebab-case names, one or more
  hooks per file. The schema, verbatim from the docs:

```json
{
  "version": "v1",
  "hooks": [
    {
      "name": "Lint on save",
      "trigger": "PostFileSave",
      "matcher": "\\.(ts|tsx)$",
      "action": { "type": "command", "command": "npx eslint --fix" }
    }
  ]
}
```

- Schema fields: `version` (required, `"v1"`), `hooks` (required
  array), `hooks[].name` (required), `hooks[].description`
  (optional, documentation only), `hooks[].trigger` (required,
  PascalCase event name), `hooks[].matcher` (optional; for
  PreToolUse/PostToolUse a tool selector or regex against the tool
  ID; for file events a regex against the file path; defaults to
  always-match), `hooks[].action.type` (required, `"command"` or
  `"agent"`), `hooks[].action.command` (required for command
  actions), `hooks[].action.prompt` (required for agent actions),
  `hooks[].timeout` (optional, seconds, default 60, 0 disables,
  ignored for agent actions), `hooks[].enabled` (optional, default
  true), `hooks[].confirm` (optional, confirmation prompt, only for
  `Stop` trigger command hooks).
- Command actions run a shell command in the project root and
  receive session context as JSON on stdin. The `{{filePath}}`
  template variable is available for file-related triggers. Agent
  actions inject a prompt into the current conversation.
- Trigger list with surface availability (from the hook types page).
  Web can store hook configuration for later local use, but Web
  sessions do not run these triggers. This is the single most
  important honesty constraint for the write-up:

| Trigger | IDE | CLI | Web |
| --- | --- | --- | --- |
| Prompt Submit | yes | yes | no |
| Agent Stop | yes | yes | no |
| Session Start | yes | V3 | no |
| Agent Spawn | no | 2.x / V3 alias | no |
| Session End | no | V3 | no |
| Pre Compaction | yes | V3 3.1.0+ | no |
| Post Compaction | yes | V3 3.1.0+ | no |
| Pre Tool Use | yes | yes | no |
| Post Tool Use | yes | yes | no |
| File Create | yes | V3 | no |
| File Save | yes | V3 | no |
| File Delete | yes | V3 | no |
| Pre Task Execution | yes | V3 | no |
| Post Task Execution | yes | V3 | no |
| Manual | no | listed in V3, not invocable | no |

- There is no git-commit trigger, no pre-commit trigger, and no
  file-save trigger that fires on manual editor saves. File triggers
  fire when the agent changes files. The docs' own use-case list
  says "validate before commit: check code quality before the agent
  finalizes changes," but the mechanism is a task or stop trigger,
  not a git hook. Any hook file claiming a commit trigger is
  invented.
- Pre Tool Use can block tool execution; it is the only blocking
  trigger family besides Prompt Submit (IDE only for blocking).
  Tool matchers accept built-in categories (`read`, `write`,
  `shell`, `web`, `spec`), source selectors (`@mcp`, `@powers`,
  `@builtin`, `@<server>`, `@<server>/<tool>`), regexes, and (in
  JSON files only) `*` and `?` wildcards. MCP tool events use the
  sanitized internal ID `mcp_<server>_<tool>` in the event JSON.
- New Manual-trigger hooks cannot be created in the v1 schema. For a
  new on-demand workflow, the docs direct authors to a manually
  included steering file, which runs as a `/<filename>` slash
  command. Legacy IDE 0.x `userTriggered` hooks show with a legacy
  label and remain runnable, but cannot be newly created.
- Legacy migration: the old `.kiro.hook` format with `when`/`then`,
  glob `patterns`, and `askAgent`/`runCommand` maps to the new
  `trigger` (PascalCase), regex `matcher`, and `action.type`
  `agent`/`command`. The IDE migrates legacy hooks through the Agent
  Hooks panel. Albedian's five `.kiro.hook` files (section 3.2) are
  legacy format; Frankenguard must not copy that shape.

### 4.4 MCP servers

Source: https://kiro.dev/docs/mcp/configuration/ (full page read
via search extract 2026-11-12). Secondary: repost.aws Kiro/MCP
getting-started guide, caxtonidowu.com Kiro MCP guide.

- Configuration files are JSON with a top-level `mcpServers` map.
  Each server entry: `command` (string, required for local servers),
  `args` (array, optional), `env` (object, optional), `disabled`
  (boolean, optional, default false), `autoApprove` (array of tool
  names to run without prompting, optional), `url` (string, required
  for remote servers: HTTPS endpoint, or HTTP for localhost).
- Two levels: workspace `.kiro/settings/mcp.json` (project-specific)
  and user `~/.kiro/settings/mcp.json` (global). If both exist, they
  merge with workspace settings taking precedence. Full precedence,
  highest to lowest: agent config `mcpServers` field, workspace MCP
  JSON, global MCP JSON.
- Changes apply automatically when the config file is saved; servers
  reconnect. Kiro does not inherit the shell's PATH variable, so
  server binaries should use full absolute paths; Node-based servers
  may need the Node bin directory in `env.PATH`. A config that says
  `"command": "node"` works only when `node` resolves in Kiro's
  minimal environment. This caveat must be documented wherever the
  config is presented.
- MCP servers are local processes Kiro launches, or remote HTTPS
  endpoints. Our MCP server is a stdio JSON-RPC 2.0 process over
  Node with zero dependencies, which fits the local-server shape
  exactly. Signal Box's MCP route (section 3.1) is the remote shape:
  an HTTP endpoint serving `initialize`, `tools/list`, and
  `tools/call` through the official MCP SDK.

### 4.5 Custom agents

Sources: https://kiro.dev/docs/custom-agents/ (updated 3 Nov 2026),
https://kiro.dev/docs/custom-agents/configuration-reference/
(updated 6 days before this research, IDE 1.0 and CLI V3 format).

- A custom agent is a configuration file that specifies which tools
  the agent can access, what permissions it has, and what context it
  includes. Project agents live in `.kiro/agents/` and are shared
  through version control; global agents live in `~/.kiro/agents/`.
  Project agents load only if the workspace is trusted. Project
  agents are available in the IDE, CLI, and Web; global agents in
  the IDE and CLI only.
- Two formats with identical fields: JSON, or Markdown with YAML
  frontmatter holding the configuration and the document body as the
  system prompt. Markdown suits long prompts; JSON suits generated
  configs. Example from the docs: `.kiro/agents/backend-dev.md`
  with frontmatter `name`, `description`, `model`, `tools`,
  `excludedTools`, `resources`.
- Fields: `name` (optional, derived from filename), `description`,
  `prompt` (system prompt; inline text or `file://` URI), `model`,
  `tools`, `excludedTools`, `permissions`, `resources`, `mcpServers`,
  `includeMcpJson` (inherits servers from global/workspace
  `mcp.json`). Older configs using `allowedTools` or `toolsSettings`
  without a `permissions` block must be converted with
  `/upgrade-agent` before CLI V3 can load them.
- `tools` and `permissions` use different namespaces, and confusing
  them is the common error. `tools` takes selectors: short names
  `read`, `write`, `shell`, `web`, plus `@builtin`, `@mcp`,
  `@<server>`, `@<server>/<tool>`, and `*`. `permissions` takes
  capability names such as `fs_read`, `fs_write`, and `shell`. The
  `tools` field decides what the agent can see and call; `permissions`
  decides what those tools may do.
- `resources` loads context: `file://` URIs (immediate),
  `skill://` references (progressively loaded on demand), and
  `knowledgeBase` entries. Skills load metadata at startup and full
  content on demand; skill files must begin with YAML frontmatter
  containing `name` and `description`. Steering files are NOT
  auto-included in custom agents (see 4.2); they must be added to
  `resources` explicitly.
- Built-in agents use the same framework: Spec, Quick Spec, Bug Fix,
  and others. The Spec family produces the formal documents in
  `.kiro/specs/`.

### 4.6 Kiro powers

Sources: https://kiro.dev/blog/introducing-powers/ (official launch
post), https://dev.to/aws-builders/kiro-powers-give-your-ai-agent-superpowers-not-context-overload-5cg0,
https://dev.to/gunnargrosch/building-the-aws-serverless-power-for-kiro-25f2,
https://github.com/andrewjdarnell/cross-platform-ai-tooling/blob/HEAD/generated/amazon-kiro.md
(researched 15-16 Aug 2026).

- A power is an installable bundle of MCP servers, Agent Skills, and
  steering that Kiro loads into context only when the conversation
  touches it. The docs definition: "Kiro powers give your AI agent
  instant access to specialized knowledge for any technology. Powers
  package your tools, workflows, and best practices into a format
  that Kiro can activate on-demand."
- Anatomy (original format): `POWER.md` (entry-point steering file
  and onboarding manual: available tools, when to use them, best
  practices, workflows, troubleshooting), `mcp.json` (MCP server
  configuration), and optional `steering/` workflow guides and hooks.
  Activation keywords live in the `POWER.md` frontmatter: mention
  "payments" and the Stripe power loads; switch topics and it
  deactivates. Since IDE v1.0.288 (7 Aug 2026), powers follow the
  open Agent Plugin format: `plugin.json` manifest with `$schema`,
  `name`, `version`, `description`, `author`, and `keywords`,
  plus `skills/`, optional `mcp.json`, and `dev.kiro/steering/`.
- Discovery and install happen through the IDE powers panel, the
  registry at kiro.dev/powers, a public GitHub URL, or a local
  folder. Launch partners: Datadog, Dynatrace, Figma, Neon, Netlify,
  Postman, Supabase, Stripe, Strands Agents, Amazon Aurora.
  `kirodotdev/powers` publishes 38 powers.
- Powers work in the Kiro IDE (per the launch post). A power is a
  developer-environment artifact, not a repo artifact: installing a
  power does not put files in the project repo. Consequence for the
  write-up: the powers question can only be answered from the actual
  Kiro session record. If no power was installed and used, the
  honest answer is that none was used and the MCP server was wired
  directly instead. Inventing power usage is exactly the kind of
  claim a Kiro-team judge checks first.

### 4.7 Property-based testing

Sources: https://builder.aws.com/content/371Pzxvbdg0KldbLzPZIiTIe86I/dev-track-spotlight-spec-driven-development-with-kiro-dev314
(DEV314, Erik Hanchett and Nikhil Swaminathan, Dec 2025),
https://developer.mamezou-tech.com/en/blogs/2025/12/17/kiro_ide_pbt/,
AWS "Kiro: Zero to Hero 05" deck.

- "Correctness verification with property-based tests" shipped as a
  Kiro IDE feature at GA on 17 Nov 2025. The official doc is titled
  "Correctness with Property-based tests."
- Mechanism: during the design phase, Kiro analyzes the EARS
  acceptance criteria and declares correctness properties as design
  artifacts. Each property links back to its source requirement.
  Tests are generated with a framework such as fast-check, running
  hundreds of randomized inputs (the DEV314 demo ran 100+ iterations
  per property). A failing property produces a shrunk
  counterexample showing whether to fix the code, the test, or the
  requirement.
- Scope limit, stated in the AWS deck: property-based testing with
  properties linked to tasks and results is IDE-only. Kiro CLI can
  still write fast-check property tests as ordinary tasks, but they
  are not the linked IDE feature. Property tests are optional by
  default, and Run all Tasks runs only required tasks.
- What this means for Frankenguard: the invariant tests over seeded
  random inputs are property-style tests. They are not Kiro IDE PBT
  output. The write-up must say which requirements each invariant
  covers, what seed and iteration counts were used, and whether any
  invariant caught a bug the example tests missed. Signal Box's
  submission text (section 3.1) is the model: named seed, exact
  counts, exact shrink results, and the honest note that other seeds
  can produce different counts.

## 5. Corrections required before the build phase ships anything

These are recorded findings, not applied changes. The STOP order for
this run forbade touching existing files. The build phase applies
each item, then re-verifies. Nothing in this list is optional.

1. `.kiro/hooks/test-on-save.json`: rewrite to the v1 schema. The
   current file is a bare object with a `trigger` object
   (`{type: "fileSave", patterns: [...]}`), which matches no Kiro
   schema version. Correct shape: `{"version": "v1", "hooks":
   [{"name": ..., "trigger": "PostFileSave", "matcher": "<regex>",
   "action": {"type": "command", "command": "npm test"}}]}`. The
   matcher is a regex against the file path, not a glob array. A
   regex such as `^(src|tests|tools)/.*\.js$` covers the intended
   files; verify the exact pattern against the docs example
   (`"\.(ts|tsx)$"`) when writing it.
2. `.kiro/hooks/verify-before-commit.json`: delete the concept, keep
   the intent. There is no `preCommit` trigger. Replace with a
   `PostTaskExecution` hook named `verify-after-task` that runs
   `npm run build && npm run verify` after each spec task completes,
   which is the documented trigger for "run tests after a task
   completes to verify correctness." Rename the file to match.
   Do not describe it as running before commits anywhere.
3. `.kiro/steering/product.md`, `tech.md`, `structure.md`: add YAML
   frontmatter as the first content, `inclusion: always`, explicit.
   Add a fourth file, `money-safety.md`, with `inclusion: fileMatch`
   and a `fileMatchPattern` array covering `src/**`, `tests/**`,
   and `app/**`, carrying the decision-path rules (integer minor
   units from parse onward, no floats in money math, fixed gate
   order, skipped gates are null, never decide a verdict). The
   fileMatch file is the steering strategy the write-up points to
   when answering prompt 5.
4. `.kiro/agents/payment-guard-reviewer.md`: keep the Markdown
   format, it is valid. Fix three things: add `resources` with
   `file://.kiro/steering/*.md` and the spec design file, because
   without it the agent loads no steering context; change tool
   selectors to the `@server/tool` form (`@frankenguard/evaluate_proposal`,
   `@frankenguard/get_policy`, `@frankenguard/audit_tail`), keeping
   `read` for source inspection and no `write` or `shell`, since a
   reviewer that can edit the policy it reviews is a conflict of
   interest; remove or replace `model: default`, which is not a
   documented model value, with a real model identifier verified
   against current Kiro docs at build time, or drop the field and
   let the default apply silently.
5. `.kiro/settings/mcp.json`: the shape is valid (`mcpServers`,
   `command`, `args`, `env`, `disabled`, `autoApprove`). Two honesty
   fixes: document in the README that Kiro does not inherit the
   shell PATH, so `"command": "node"` must be replaced with the full
   node path on machines where `node` is not on Kiro's minimal PATH;
   and document why all three tools are in `autoApprove` (they are
   read-only evaluations against local data, they move no money and
   write nothing).
6. `.kiro/specs/frankenguard/tasks.md`: add `_Requirements: X.Y_`
   traceability lines under each task, per the AWS deck convention.
   Check off tasks 14-16 only when the work they describe is done
   and verified, not in advance.
7. `.kiro/specs/frankenguard/design.md`: name the correctness
   properties P1-P6 explicitly, each linked to its EARS requirement,
   with the seed and iteration counts used. This is what makes the
   PBT answer in the write-up checkable.
8. UI: full bright rebuild per section 7. The existing dark design
   must not ship in any form.
9. README, build journal, and submission draft: re-audit claim by
   claim after the rebuild, using the checklist in section 8. The
   NecroSpec failure (README claims files the tree lacks) must be
   mechanically impossible in this repo: every file named in prose
   must exist, every test count must match a real run, every URL
   must return 200.

## 6. Judging criteria map: five criteria, concrete answers

Each criterion is worth 10 points. The map states the judges'
question verbatim, the concrete answer in the build, where the
evidence lives, and the gap that must be closed before submission.
Scores are not predicted; risks are named.

### 6.1 Potential Impact (10 points)

Judges ask: credible case for a real problem for a real audience,
solution addressing it as demonstrated, useful, intuitive,
accessible, would someone actually use this?

- Problem: AI agents are being given payment powers with only the
  model's judgment between an instruction and money moving. A
  persuasive memo, a misread amount, or a wrong payee becomes a real
  transfer. The guardrail must be deterministic, inspectable, and
  outside the model's control. This is not a hypothetical failure
  mode; it is the default architecture of every agent that can pay.
- Audience: developers shipping agent payment features, and finance
  operations teams who must approve what agents propose. Both need
  the same thing: a verdict with evidence, not a score.
- Demonstrated answer: the live demo takes a plain-language proposal
  ("Pay Acme $250 for INV-1042"), runs it through six named gates,
  and returns a verdict with a full trace, a budget meter, and a
  hash-chained ledger entry. The rogue simulator runs injection
  memos, amount tricks, unknown payees, and freeze scenarios on
  demand. A judge sees the problem and the solution in the first
  minute, with no account and no setup.
- Evidence: live demo URL, rogue simulator, gate trace, ledger with
  tamper check, README problem statement, video showing an attack
  being refused.
- Gap to close: the demo must prove usefulness in 30 seconds for a
  judge who never clicks past the first screen. The first screen
  must show a proposal, a verdict, and a trace without scrolling.
  Accessibility: WCAG AA contrast on the bright palette, keyboard
  operability, reduced-motion support. All three are build-phase
  requirements, not polish.

### 6.2 Technological Implementation (10 points)

Judges ask: thorough and skillful Kiro use, thoughtful AI development
strategy, variety of Kiro tools used impactfully, deep understanding
of Kiro features, experimentation.

This criterion is won or lost in the write-up plus the `/.kiro`
directory. The mapping to the eight write-up prompts:

1. Surfaces: Kiro Web ran the real spec workflow (requirements,
   design, tasks, steering) in the credited session; the parent
   agent holds that session record and it must be incorporated
   before submission. Hooks and MCP config are stored in the repo
   for IDE and CLI use; hooks do not execute on Web, and the
   write-up says so. No claim is made about surfaces that were not
   used.
2. Custom agents: one reviewer agent, read-only by design, wired to
   the project's own MCP tools, with steering loaded through
   `resources`. Impact: the reviewer cannot approve on vibes; it
   must call the engine and quote the trace.
3. Hooks: two v1 JSON hooks with real triggers (PostFileSave test
   run, PostTaskExecution build plus verify). The write-up names the
   exact workflows and what each one caught or prevented.
4. Spec-driven development: one Feature Spec, requirements-first,
   EARS acceptance criteria, design with named correctness
   properties, tasks with requirement traceability, approval gates
   between phases. The comparison to vibe coding must be specific:
   what the spec caught that chat-first building would have missed
   (the gate-order decision, the integer-cents decision, the
   skipped-gate null decision).
5. Steering: four files, three always-on foundation files plus one
   fileMatch-scoped money-safety file. The strategy that made the
   biggest difference: scoping the money rules to decision-path
   files so they load exactly when the agent touches money code.
6. MCP: a working stdio MCP server in the repo exposing the same
   engine the UI uses, with three tools. What it enables that would
   otherwise be difficult: any Kiro agent can evaluate a proposal
   through the deterministic engine instead of reasoning about
   policy in prose, and the reviewer agent can audit without
   reimplementing anything.
7. PBT: six named invariants over seeded random inputs, including a
   tamper fuzz over 100 chains. The write-up names the seed, the
   counts, and whether any invariant caught a bug the example tests
   missed. It does not call this Kiro IDE PBT.
8. Powers: answered only from the session record. If no power was
   used, say so and say why direct MCP wiring was the right call
   for a zero-dependency project. Never invent power usage.
- Experimentation evidence: the deterministic build (identical
  SHA-256 across runs), the secure-context guard that fails visibly
  instead of silently, the CSV formula-injection guard. Each is a
  small, checkable decision, not a claim.
- Gap to close: every item above depends on the corrections in
  section 5 and on the parent's Kiro Web session record. Without
  the record, the write-up cannot be finalized honestly.

### 6.3 Design (10 points)

Judges ask: complete, coherent product experience, not a technical
proof of concept; intuitive, polished, intentional.

- The product experience: one page that is the guard's console.
  Proposal input, policy controls, verdict with trace, budget meter,
  ledger with verify and tamper check, rogue simulator, export. No
  dead buttons, no placeholder sections, no lorem ipsum.
- The theme: Kiroween plus Frankenstein plus Kiro purple ghost,
  expressed in vivid color on a bright base per section 7. The
  monster-mashup motif (stitched seams, bolts, mismatched parts) is
  visible in the UI itself, not described in copy.
- Cara kerja: the page explains how the product works (proposal in,
  six gates, verdict out, ledger entry), per the standing rule that
  every project site must explain how the product works, not just
  show live data.
- Design principles check: the five adopted principles (information,
  proportion, emphasis, clarity, space) are applied and checked
  before the screenshot verdict gate.
- Evidence: live demo, screenshots in the submission, README
  screenshots or GIFs (the 2025 winner pattern), design tokens
  documented in the build journal.
- Gap to close: the bright redesign (section 7) and the screenshot
  verdict gate. No deploy of the redesign before the user sees a
  screenshot. The current dark design must not be submitted.

### 6.4 Innovation/Idea (10 points)

Judges ask: creative and novel concept, differs from existing
concepts, unusual technologies or public resources combined in a
unique way.

- The chimera, mapped to the category definition: five seemingly
  incompatible elements stitched into one artifact. (1) Natural
  language intent parsing with a strict, hostile-input-aware
  grammar. (2) A deterministic 1970s-style rule engine with fixed
  gate order and integer money math. (3) A SHA-256 hash-chained
  audit ledger with tamper detection. (4) An MCP server exposing
  the same engine to other agents. (5) A single self-contained
  deployable file with a deterministic build. No single element is
  new. The combination is the idea: the agent proposes, the monster
  decides, and every decision leaves evidence anyone can verify.
- Differentiation, verified against the field: CodeVault has the
  chain but no live decision loop. Skeleton Key has "model reads,
  code decides" but in document checking, with a backend and an
  allowance, and no ledger or MCP server. Signal Box has the
  evidence standard but is a mutex tower, not a payment guard.
  GhostPR has the closed loop but needs external services. No
  rival combines all five elements in a zero-dependency artifact.
- Gap to close: the write-up must name the five elements explicitly
  and say why each one is incompatible with the others on its face.
  If the Frankenstein framing is only in the name, the criterion
  score caps out. The framing must be in the architecture.

### 6.5 Presentation (10 points)

Judges ask: video clearly demonstrates the project end to end, pitch
communicates problem, audience, and why it matters, easy to follow,
creative and memorable.

- Video (the user's job to upload; the build phase supplies a shot
  list and script): under 3 minutes, public YouTube, no copyrighted
  music, no third-party trademarks. Structure: problem in 20
  seconds, clean proposal and PASS verdict in 40 seconds, three
  attacks refused (injection memo, over-cap amount, unknown payee)
  in 60 seconds, tamper check in 20 seconds, close on the ledger.
  Every second shows the real product working. Free-Mint Triage's
  67-second video is the brevity reference; Signal Box's launch
  film plus blog plus social post is the full-package reference.
- Text: the Devpost description leads with the problem and the
  one-sentence concept, then the demo path, then the Kiro write-up
  answering all eight prompts, then honest limits. Screenshots show
  the verdict, the trace, and the ledger, not the hero section.
- Memorability: the monster framing ("the agent proposes, the
  monster decides") plus the attackable demo. A judge who tries to
  break it and fails remembers it.
- Gap to close: video script and shot list are build-phase outputs.
  The submission draft must be rewritten after the bright redesign
  so its screenshots and descriptions match the shipped UI.

## 7. UI direction: bright, themed, alive

Standing rules that govern this section: no all-dark default theme
(user order 2026-11-12, recorded as a UI theme override retiring the
old near-black dashboard reference); the design must follow the
competition and project theme, not a generic look; screenshot
verdict gate before deploy; full of color within the theme palette;
five design principles check.

### 7.1 Kiroween and Kiro identity, as verified

- Kiro brand: a white cartoon ghost mascot with two black oval eyes,
  and purple as the prominent brand color. Verified across the
  official @kirodotdev Instagram graphics (bright purple backgrounds,
  white ghost, outlined KIRO wordmark), third-party Kiro coverage
  describing the CLI rebrand as "purple prominent," and the AWS
  deck convention (purple marks key points and decisions, blue is
  Kiro at work). No official Kiro brand hex code was found in any
  public source checked. Palette values below are the user's
  specified codes, not claimed official Kiro values.
- Kiroween 2025 promo identity (official Kiro Instagram post):
  purple lighting, pumpkins, jack-o-lantern, disco ball, floating
  purple ghost, Frankenstein-style character, skeletons,
  spider-legged ghost. Playful, not horror. The 2026 rules page
  carries the same pumpkin plus ghost emoji framing.
- Frankenstein category identity: stitched-together parts, bolts,
  mismatched pieces forming one working whole. The motif must be
  graphic (stitched seams, bolt icons, visibly joined panels), not
  a dark laboratory.

### 7.2 Exact palette: user-specified 60-30-10

Source: user order 2026-11-12, codes read from
https://www.biznetgio.com/blog/kode-warna-html/. Use these exact
codes. The article's dark-mode palette is skipped entirely. No dark
theme.

- 60% light base: Cloud Gray #F2F2F2, Baby Blue #D7EBFF, Lavender
  Mist #E9E2FF. The page background and large surfaces live here.
- 30% secondary: Flat Purple #9B59B6 and Material Deep Purple
  #673AB7 for the Kiro purple (headers, primary buttons, key
  panels), Flat Blue #3498DB for secondary surfaces and links.
- 10% accents: Hot Neon Orange #FF5F1F for pumpkin CTAs, Neon Green
  #39FF14 for Frankenstein electric accents used sparingly, Flat
  Yellow #F1C40F for highlights. Neon only as accents, never as big
  backgrounds.
- Hero gradient: Royal #8E2DE2 to #4A00E0.
- Semantic colors: success #16A34A, warning #F59E0B, error #EF4444,
  info #0EA5E9.
- Contrast discipline (pro requirement, not optional): Neon Green
  #39FF14 must never be text on a light background; it fails
  contrast. Use it only as small fills, glows, or graphic accents
  with dark adjacent text. Success text uses #16A34A, not neon
  green. Hot Neon Orange #FF5F1F as a CTA fill takes white or very
  dark text only after a contrast check; verify, do not assume.
  All text must meet WCAG AA on the bright base. Phantom Inbox's
  rule (WCAG AA in both views) applies here to the single bright
  view.

### 7.3 References: what to steal from the best-looking entries

- Phantom Inbox (section 3.2): the dual-view pattern. Calm,
  high-contrast, large-text default; atmosphere as an opt-in layer;
  WCAG AA in both; reduced-motion parity. Frankenguard takes the
  calm bright default and the contrast discipline. The haunted
  layer is optional and must never become the default.
- Skeleton Key (section 3.2): the "Lights on" mode and automatic
  reduced-motion handling. A theme must respect the user's motion
  and contrast settings, not fight them.
- Signal Box and FrankenAmp (section 3.1): world-commitment. The
  UI recreates its subject's world (brass lever frame, Winamp
  player). Frankenguard's console must look like the guard's own
  machine: stitched panels, bolt details, a gate trace that reads
  like a monster's checklist.
- Albedian steering (verified from the repo): never use color
  alone; pair every color with distinct marker geometry and text
  labels. Use tabular numerals for all money, timestamps, and
  counts. Respect `prefers-reduced-motion` by replacing motion
  with short crossfades. Maintain keyboard parity for every action.
  All four rules apply to Frankenguard unchanged.
- Kiro InteractionKit, 2025 Grand Prize winner (section 2): GIFs
  and screenshots in the README showing the thing moving. The
  submission and README must show motion and verdicts, not just
  describe them.

### 7.4 Build-phase UI requirements

1. Bright base from the 60% palette. No near-black backgrounds
   anywhere, including the hero, the console, and the ledger.
2. The monster-mashup motif is graphic and visible: stitched seams
   (dashed borders), bolt icons, panels that look joined from
   mismatched parts. An original ghost mascot drawn as simple SVG;
   do not copy Kiro's logo or any trademarked asset.
3. The gate trace is the hero. A verdict without its trace visible
   is a failed screen.
4. Cara kerja section on the page: proposal in, six gates, verdict
   out, ledger entry. Steps plus flow, not just live data.
5. Big display type, clear hierarchy (headline biggest), generous
   negative space. Checked against the five design principles
   before the screenshot gate.
6. Screenshot for the user's verdict before deploy or full
   production. The user judges bright and alive; no screenshot, no
   deploy.
7. Reduced-motion support, keyboard operability, WCAG AA contrast.
   Verified, not assumed.

### 7.5 Binding design tokens: colors, fonts, typography

These tokens are binding for the build phase, from the user's two
reference links. They override any earlier design decision in this
repo, including the earlier font rotation that deliberately avoided
Space Grotesk. That rotation is superseded. Use exactly these tokens.

Colors (Biznet Gio reference, exact codes from the user order,
60-30-10 as specified in 7.2): light base #F2F2F2, #D7EBFF,
#E9E2FF; secondary #9B59B6, #673AB7, #3498DB; accents #FF5F1F,
#39FF14 (sparingly), #F1C40F; hero gradient #8E2DE2 to #4A00E0;
semantic success #16A34A, warning #F59E0B, error #EF4444, info
#0EA5E9. Neon accents only, never big backgrounds, no dark theme.

Fonts (Untitled UI "31 best free fonts 2026" reference, selections
as specified in the user order; the article URL was not supplied
with the order, so the selections are recorded verbatim):

- Space Grotesk: display and headlines only.
- Inter: body and UI text.
- Geist Mono: code, hashes, and terminal text only. Never body copy.

Typography rules (user order, verbatim intent): base font size
16px; body line-height 1.5x to 2x; headline line-height 1x to
1.25x; tightened letter-spacing on display type; use 5 or more
weights across the type system; build hierarchy through weight and
size, not through color alone.

Build-phase notes: Space Grotesk and Inter are Google Fonts
staples; Geist Mono availability on the chosen font CDN must be
verified at build time, with monospace fallback stacks in place so
the single-file demo never renders code text in a proportional
font when offline. Font loading must not block first render of the
verdict screen. The earlier Bricolage Grotesk plus IBM Plex Mono
direction is dead; do not mix it back in.

## 8. Pre-submission audit checklist

Run in full before any submission. Every item is a check with a
pass condition, not a reminder. The study-everything order requires
that nothing ships with known gaps; anything that fails is fixed or
honestly documented in the submission text.

1. Rules re-read: confirm no material changes to criteria,
   eligibility, or prizes since 12 Nov 2026 (section 11 requires
   notification, but verify anyway).
2. Gallery re-scan from a logged-in session: new Frankenstein
   entries, new overall threats, category placements. Update
   section 3.
3. Tree versus prose: every file named in the README, build
   journal, and submission draft exists in the repo tree. Every
   test count matches a real `npm test` run on the submitted
   commit. Every URL returns 200.
4. `.kiro` audit: `/.kiro` at root, not in `.gitignore`; specs,
   steering (with frontmatter), hooks (v1 JSON, real triggers),
   MCP config, and agent file all present and schema-valid;
   JSON files parse; no invented triggers, fields, or model names.
5. Secret scan: no credentials, tokens, keys, passwords, or
   personal emails in any committed file, including history. No
   credentials of any kind, following the NecroSpec warning.
6. Identity sweep: zero mentions of the Kiro session account in
   any repo file, README, write-up, or submission text. Only the
   registered identity (dropjoin, M Aziz Yahya, dropjoin0@gmail.com)
   appears in organizer-facing materials.
7. Tests: `npm test` green on the submitted commit; invariant
   tests report seed and counts; DOM smoke test green against the
   shipped file; build deterministic (two runs, identical SHA-256);
   `npm run verify` green.
8. Live demo: URL live, byte-identical to the shipped file,
   reachable with no login, no console errors, works after load
   with no backend. Demo stays live until the judging period ends
   (29 Jan 2027).
9. UI: bright palette per section 7.2, WCAG AA contrast verified,
   reduced-motion and keyboard checks done, screenshot verdict
   received from the user, no em dash in the page title.
10. Kiro write-up: all eight prompts answered with specifics;
    Kiro Web session record incorporated; no claim about hooks
    executing on Web; no invented power usage; PBT described
    honestly as property-style tests with seeds and counts.
11. Honest limits: the UTC-midnight daily-cap edge, the
    deterministic parser's limits, the fictional vendors, and the
    no-real-money statement appear on the page, in the README, and
    in the spec. Nothing the demo cannot do is implied otherwise.
12. Video: under 3 minutes, public YouTube, real footage of the
    product, no copyrighted music, no third-party trademarks.
    Uploaded by the user; script and shot list supplied by the
    build phase.
13. License: MIT license file present, detectable in the GitHub
    About section. Repo public. No `.gitignore` entry hiding
    `/.kiro` or any submitted artifact.
14. Bonus prizes: blog post published during the submission period
    with the required Kiroween 2026 mention (if ordered); social
    post starting with #KiroweenHackathon26 (if ordered). Both are
    user-posted; Muse supplies drafts only.
15. Final read: the full submission text read aloud once for
    AI-template phrasing. Anything generic is rewritten in the
    builder's voice with specific evidence, or cut.

## 9. Sources

Official rules and contest pages:

- https://kiroween.devpost.com/rules (all 619 lines, 2026-11-12)
- https://kiroween-2025.devpost.com/ (full page, 2026-11-12)
- https://kiro.dev/blog/kiroween-2025/
- https://devpost.com/software/ghostpr-autofix-ai
- https://devpost.com/software/a-haunted-winamp-revival
- https://devpost.com/software/codevault-mc72o4
- https://devpost.com/software/gitbridge-ai
- https://devpost.com/software/free-mint-triage
- https://devpost.com/software/kiroween-signal-box (full page,
  2026-11-12)
- https://dev.to/mateo_cocco_6905648eea0d2/my-first-kiro-app-was-a-winner-heres-how-im-building-a-monster-3ap9

Kiro documentation (kiro.dev/docs):

- https://kiro.dev/docs/specs/
- https://kiro.dev/docs/specs/best-practices/
- https://kiro.dev/docs/getting-started/first-project/
- https://kiro.dev/docs/custom-agents/built-in/
- https://kiro.dev/docs/steering/
- https://kiro.dev/docs/hooks/
- https://kiro.dev/docs/hooks/types/
- https://kiro.dev/docs/ide/whats-new-v1/hooks/
- https://kiro.dev/docs/mcp/configuration/
- https://kiro.dev/docs/custom-agents/
- https://kiro.dev/docs/custom-agents/configuration-reference/
- https://kiro.dev/blog/introducing-powers/
- https://kiro.dev/blog/from-chat-to-specs-deep-dive/
- https://kiro.dev/blog/specs-bugfix-and-design-first/

Kiro secondary sources (labeled as such in the text):

- https://speakerdeck.com/inariku/kiro-spec-driven-development-intro-en
  (AWS "Kiro: Zero to Hero 05")
- https://builder.aws.com/content/371Pzxvbdg0KldbLzPZIiTIe86I/dev-track-spotlight-spec-driven-development-with-kiro-dev314
- https://developer.mamezou-tech.com/en/blogs/2025/12/17/kiro_ide_pbt/
- https://www.memorylake.ai/en/blogs/split-kiro-steering-for-ide-and-cli
- https://troiana.net/guides/kiro/
- https://dev.to/aws-builders/kiro-powers-give-your-ai-agent-superpowers-not-context-overload-5cg0
- https://dev.to/gunnargrosch/building-the-aws-serverless-power-for-kiro-25f2
- https://github.com/andrewjdarnell/cross-platform-ai-tooling/blob/HEAD/generated/amazon-kiro.md
- https://builder.aws.com/content/3AtjSJuI5qf078RwqX7FCj2xNvi/kiro-anatomy-a-visual-guide-to-mastering-ai-assisted-development

Repositories inspected via GitHub API, 2026-11-12:

- https://github.com/charonmaseka-cell/skeleton-key-kiroween2026
- https://github.com/dustin-lap1/kiroween
- https://github.com/LMH-gh/civkiro-1991-kiroween2026
- https://github.com/mukeshkbj/Kiroween26
- https://github.com/DarkerMinecraft/Kiroween2026
- https://github.com/azrelazyzz/Kiroween2026-Music
- https://github.com/VRCHAMPION/kiroween
- https://github.com/glendonC/albedian
- https://github.com/Harpita-P/Kiro-InteractionKit
- https://github.com/Miladmet/ghost-pr
- https://github.com/pikyoe/free-mint-triage
- https://github.com/vhmns14/server-familiar
- https://github.com/DunsinK/Kiroween2026 (empty)
- https://github.com/elhamnazif/kiroween26 (empty)
- https://github.com/plat16022005/kiroween2026 (README only)
- https://github.com/timmyspurs12/kiroween (README only)
- https://github.com/victrvondoom/Kiroween (empty)

Live demos fetched:

- https://skeleton-key-scopecheck.pages.dev/ (full page text,
  2026-11-12)

Color reference (user-supplied):

- https://www.biznetgio.com/blog/kode-warna-html/ (codes as given
  in the user order; the article itself was not re-fetched in this
  run, the user's stated codes are used verbatim)
