# Retrieval notes: Kiro spec files

The three files in this directory are the Kiro spec-driven-development output
for FrankenGuard (requirements, design, tasks), retrieved from the Kiro Web
spec session on 2026-11-13. The session's spec panel "Download files" action
produced no verified file in the retrieval browser, so the contents were
recovered by reading the spec panel text and the session chat pastes, in
~150-line chunks, one file at a time.

What is complete, as stated by the session:

- `requirements.md`: complete, 215 lines.
- `design.md`: prose and code complete, 820 lines.
- `tasks.md`: Phases 0-8 and the 5 suggested checkpoints complete.

What could not be verified from the session display is marked in place with
bracketed notes (`[TERPOTONG ...]` / `[TABEL ...]`). Those bracketed notes
are retrieval annotations, not Kiro's text:

- design §1 decisions table rows (summary captured only).
- design §3.2 reason-code table rows, §3.4 audit-entry table cells, §7 seed
  labels, §8.4.1 `--stitch` value and some contrast-ratio rows, §8.4.2
  area-usage table cells, §8.3 panel table, §6.4 last row, §9 last row,
  §10/§12 first-bullet tails.
- tasks §3.3 first bullet, several long Verify tails in Phases 6-8.
- tasks Requirement Coverage Matrix: title only, no rows captured. The
  per-task `Covers:` lines carry the same requirement mapping.

Known retrieval artifacts: alignment spacing inside SQL / ASCII-diagram
blocks may be normalized to single spaces, and bold markers were restored
from the code/chat view. Semantics are unchanged.

Gaps are filled during implementation by derivation from `requirements.md`
(which is complete) plus the design prose, and every derivation is noted in
the build journal. Nothing derived is presented as Kiro-verbatim.

The earlier short spec drafts written locally before the Kiro session are
preserved in git history (commit 9844818 and earlier).
