# Product steering: Frankenguard

## What this is

Frankenguard is a payment guard for AI agents. An agent proposes payments in
plain language. A deterministic, old-school rule engine cross-examines every
proposal before anything is approved: freeze switch, per-transaction cap,
daily cap, recipient allowlist, and a memo guardrail that catches instruction
injection. Every decision lands in a hash-chained audit ledger.

The monster metaphor is the product, not decoration. The app stitches parts
that were never meant to fit: a 1970s-style rule engine, a 2020s agent
workflow, and a tamper-evident ledger. Frankenstein category, literally.

## Who it is for

One person: a solo builder who lets an AI agent spend on their behalf and
wants a hard, inspectable boundary between "the agent suggested it" and
"the money moved". Judges are the second audience: every claim on the page
must be checkable in the repo or in the live demo within a minute.

## Non-negotiables

1. The rule engine is deterministic. Same proposal plus same policy plus
   same ledger state always yields the same verdict. No randomness, no LLM
   in the decision path, no vibes.
2. Fail closed. Anything malformed, ambiguous, or unparseable is rejected
   with a specific reason code, never waved through.
3. No real money. Frankenguard never connects a wallet, never signs, never
   calls a payment rail. It approves or rejects proposals; execution is
   somebody else's job. The demo says this on the page.
4. Honest demo data. The default vendors (Acme Corp, Globex, Initech,
   Hooli) are fictional. The page labels them as demo data.
5. Every number on the page is computed from the actual ledger state in the
   browser. No hardcoded stats, no fake counters.

## What success looks like

A judge opens the demo, types "pay $600 to Acme Corp", watches the engine
reject it with the exact gate that fired, flips the freeze switch, watches
everything reject, releases the rogue-agent simulator, watches six attacks
die in a row, then clicks Verify Chain and sees the ledger prove itself.
Under three minutes, zero instructions needed.
