# Product steering: FrankenGuard

## What this is

FrankenGuard is a payment guard for AI agents. An agent proposes
payments. A deterministic, old-school rule engine cross-examines
every proposal before anything is approved: freeze switch, recipient
allowlist, per-transaction cap, daily cap, in that fixed order.
Every proposal, decision, and payment lands in a hash-chained audit
ledger stored in SQLite, per visitor, in an isolated sandbox.

The monster metaphor is the product, not decoration. The app
stitches parts that were never meant to fit: a 1970s-style rule
engine, a 2020s agent workflow, and a hash-chained ledger.
Frankenstein category, literally.

## Who it is for

One person: a solo builder who lets an AI agent spend on their
behalf and wants a hard, inspectable boundary between "the agent
suggested it" and "the money moved". Judges are the second
audience: every claim on the page must be checkable in the repo or
in the live demo within a minute.

## Non-negotiables

1. The rule engine is deterministic. Same proposal plus same policy
   plus same ledger state always yields the same verdict. No
   randomness, no LLM in the decision path, no vibes. The memo
   field is data: it never affects a decision, and an injection
   attempt in a memo is evidence the engine ignored it, not a
   separate trip.
2. Fail closed. Anything malformed, ambiguous, unreadable, or
   unparseable is rejected with a specific reason code, never
   waved through. If the audit write fails, nothing executes.
3. No real money. FrankenGuard never connects a wallet, never
   signs, never calls a payment rail. It approves or rejects
   proposals against a simulated ledger; execution is somebody
   else's job. The demo says this on the page.
4. Honest demo data. The default vendors (Acme Corp, Globex Corp,
   Initech) are fictional. The page labels them as demo data.
5. Every number on the page is computed from actual server state.
   No hardcoded stats, no fake counters.
6. The audit trail is "verifiable", never "tamper-proof". Tail
   truncation is a documented limitation: deleting entries from
   the end leaves a shorter valid chain.

## What success looks like

A judge opens the demo, runs the scripted agent, watches a $100
payment approve and a $750 payment reject with the exact rule that
fired, flips the freeze switch, watches everything reject, runs the
prompt-injection scenario, watches the override memo get ignored,
then clicks Verify Chain and sees the ledger prove itself. Under
three minutes, zero instructions needed.
