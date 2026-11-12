# Requirements Document: FrankenGuard

## Introduction
FrankenGuard is a hackathon web app with a public demo. An AI agent *proposes* payments; a deterministic rule engine *cross-examines* every proposal before anything can move. The agent never executes a payment directly. Every proposal, decision, and reason is recorded in an append-only audit trail.

Every proposal is checked against four rules:
1. A per-transaction cap
2. A daily cap
3. A recipient allowlist
4. A freeze switch (emergency kill switch)

## Glossary
- **Proposal**: A payment request from the Agent: recipient, amount, memo, client-supplied idempotency key.
- **Decision**: The Rule Engine's verdict for one Proposal: APPROVED or REJECTED, plus one reason per rule.
- **Reason**: One rule's verdict, with a code, message, and the detail that supports it.
- **Audit Trail**: Append-only log recording every time a proposal was received, every decision made, every payment executed, and every configuration change.
- **Agent**: The hackathon demo's LLM-based (or scripted) proposer. Cannot move money and cannot change rules. Its output is untrusted input.
- **Rule Engine**: The deterministic component that evaluates a Proposal. It contains no AI/LLM calls and no randomness.
- **Operator**: The public page visitor or admin who toggles rules and views the audit trail.
- **Simulated Payment**: In the demo, an approved proposal "moves" money only in a simulated ledger. No real funds ever move.
- **Ledger**: A simulated balance table that tracks spending against the daily cap, in cents (no floats).

## Assumptions
- Amounts are integers in minor units, always USD, always whole cents (no movement across currencies).
- All exhibit proposals have an amount ≤ $1,000,000 per transaction and daily cap totals ≤ $10,000,000 per day.
- Single tenant / single account.

### Requirement 1: Every payment is proposed, evaluated, and audited
**User Story:** As an Operator, I want every payment the Agent wants to make to arrive as a Proposal that is checked before anything moves, so that the Agent can never move money on its own authority.
**Acceptance Criteria:**
1.1. WHEN the Agent submits a Proposal THEN the system SHALL assign it a unique ID and a server-side timestamp and persist it before evaluation begins.
1.2. WHEN a Proposal is received THEN the system SHALL validate its shape (recipient identifier present, amount is a positive integer in minor units, currency supported, memo within length limit).
1.3. IF a Proposal fails shape validation THEN the system SHALL record it in the Audit Trail with a REJECTED decision and reason INVALID_PROPOSAL, and SHALL NOT evaluate the other rules.
1.4. WHEN a Proposal is valid THEN the system SHALL pass it to the Rule Engine and SHALL obtain exactly one Decision for it.
1.5. WHEN a Decision is APPROVED THEN the system SHALL record a Simulated Payment and mark the Proposal EXECUTED.
1.6. WHEN a Decision is REJECTED THEN the system SHALL NOT record any Simulated Payment and SHALL mark the Proposal BLOCKED.
1.7. The system SHALL provide no code path that creates a Simulated Payment without an APPROVED Decision for that Proposal.
1.8. WHEN the same Proposal is submitted twice with the same client-supplied idempotency key THEN the system SHALL return the original Decision and SHALL NOT create a second Proposal or second Simulated Payment.
1.9. WHEN a Proposal has been decided THEN the system SHALL return the Decision, all Reasons, and the Proposal ID in the response.
1.10. The Agent's output SHALL be treated as untrusted input; the Rule Engine's Decision SHALL NOT depend on any Agent-provided justification text.

### Requirement 2: A deterministic rule engine evaluates every proposal
**User Story:** As an Operator, I want a deterministic rule engine to cross-examine each Proposal, so that outcomes are predictable and demonstrable.
**Acceptance Criteria:**
2.1. The Rule Engine SHALL evaluate each Proposal against all four rules: freeze switch, recipient allowlist, per-transaction cap, and daily cap, in that order.
2.2. The Rule Engine SHALL be deterministic: given identical Proposal, configuration, and ledger state, it SHALL return the same Decision and Reasons.
2.3. The Rule Engine SHALL be pure: it SHALL NOT call any AI/LLM, perform any I/O, generate any randomness, or read the system clock.
2.4. The Rule Engine SHALL evaluate a Proposal against a single frozen Config Snapshot.
2.5. The Rule Engine SHALL return exactly one Reason per rule (pass or fail), each with a code, message, and detail.
2.6. The Rule Engine SHALL evaluate ALL rules even after a failure, and the Decision SHALL include one Reason per rule (pass or fail), so the audit shows the complete picture.
2.7. IF a Proposal fails multiple rules THEN the Decision SHALL include a Reason for each failing rule, not just the first failure.
2.8. IF the Rule Engine throws an error, cannot read configuration, or cannot read ledger state THEN the system SHALL return REJECTED with reason ENGINE_ERROR (fail-closed) and SHALL record it in the Audit Trail.
2.9. Evaluation and the resulting ledger write SHALL be atomic so that concurrent Proposals cannot jointly exceed the daily cap.
2.10. Rule evaluation SHALL be independent of Agent-provided justification text, and the engine SHALL NOT consider the text of any agent explanation.

### Requirement 3: Per-transaction and daily spending caps
**User Story:** As an Operator, I want per-transaction and daily spending caps, so that a misbehaving Agent cannot cause large losses.
**Acceptance Criteria:**
3.1. WHEN a Proposal's amount is greater than the per-transaction cap THEN the rule SHALL fail with reason PER_TX_CAP_EXCEEDED.
3.2. WHEN a Proposal's amount is exactly equal to the per-transaction cap THEN the rule SHALL pass (inclusive).
3.3. The daily cap SHALL never be exceeded by the sum of simulated payments for a sandbox on a single UTC day.
3.4. Two identical concurrent Proposals SHALL NOT jointly exceed the daily cap unless the daily cap is high enough to cover both.
3.5. The cap values SHALL be integers in cents.
3.6. The daily cap SHALL always be greater than or equal to the per-transaction cap.
3.7. The per-transaction and daily cap values SHALL be configurable.
3.8. WHEN an Operator changes the caps THEN the system SHALL validate that both cap values are positive integers, that the per-transaction cap is less than or equal to the daily cap, and that both values are ≤ $10,000,000, and IF validation fails THEN the system SHALL not change them.
3.9. WHEN an Operator changes the caps THEN the system SHALL persist the new values, increment config_version, and write a CAPS_CHANGED audit entry.
3.10. WHEN an Operator changes the caps THEN the new cap values SHALL apply only to future Proposals; earlier decisions SHALL remain unchanged.
3.11. The daily totals SHALL reset at the start of the next UTC day per each sandbox, and the cap SHALL be exceeded neither by the old nor the new day's Proposals.

### Requirement 4: Recipient Allowlist
**User Story:** As an Operator, I want payments restricted to pre-approved recipients, so that the Agent cannot send money to arbitrary parties.
**Acceptance Criteria:**
4.1. WHEN a Proposal's recipient is on the allowlist THEN the rule SHALL pass with reason RECIPIENT_ALLOWED.
4.2. WHEN a Proposal's recipient is NOT on the allowlist THEN the rule SHALL fail with reason RECIPIENT_NOT_ALLOWED.
4.3. The allowlist SHALL be compared using normalized identifiers only; e.g. a recipient display name MUST NOT be used to determine allowance unless it is normalized to a recipient identifier.
4.4. The allowlist SHALL NOT match on prefixes, substrings, or case-insensitive matches.
4.5. The allowlist SHALL be changeable only through configuration changes.
4.6. WHEN a recipient is added or removed THEN the system SHALL normalize the recipient, add or remove exactly one entry, and write an ALLOWLIST_CHANGED audit entry.
4.7. WHEN a recipient is removed THEN the system SHALL NOT alter any earlier Decisions or Payments.
4.8. The allowlist SHALL have a maximum of 50 entries.

### Requirement 5: Freeze switch (emergency stop)
**User Story:** As an Operator, I want an emergency stop that blocks every payment instantly, so that I can stop a compromised Agent mid-demo.
**Acceptance Criteria:**
5.1. If and only if the system is frozen THEN every Proposal SHALL be REJECTED with reason SYSTEM_FROZEN.
5.2. While frozen, the system SHALL show the frozen state in the UI and SHALL continue to evaluate the other three rules so the complete failure picture is visible.
5.3. While frozen, the system SHALL record the REJECTED decision in the Audit Trail.
5.4. Toggling the freeze SHOULD apply to Proposals submitted after the toggle. Proposals already decided when the freeze is toggled SHALL remain as decided.
5.5. Toggling the freeze SHALL write a FREEZE_CHANGED audit entry.
5.6. Toggling the freeze SHALL not require an application restart or a redeploy.
5.7. While frozen, the freeze pill SHALL appear in the header.
5.8. IF the system cannot determine whether it is frozen THEN the system SHALL treat itself as frozen and return REJECTED with reason SYSTEM_FROZEN.
5.9. WHEN an Operator toggles the freeze value THEN the new value SHALL take effect immediately, and SHALL be reflected in subsequent Proposals.
5.10. The current freeze state SHALL be included in the API response.

### Requirement 6: Audit trail (append-only, verifiable)
**User Story:** As an Operator, I want an append-only audit trail so that I can prove what happened in a later accountability review.
**Acceptance Criteria:**
6.1. WHEN a Proposal is received THEN the Audit Trail SHALL record PROPOSAL_RECEIVED with its full payload.
6.2. WHEN a Proposal is evaluated THEN the Audit Trail SHALL record DECISION_MADE with outcome, reasons, and the config snapshot taken at evaluation.
6.3. WHEN a Simulated Payment is executed THEN the Audit Trail SHALL record PAYMENT_EXECUTED.
6.4. WHEN an Operator changes the caps, allowlist, or freeze THEN the Audit Trail SHALL record the previous value, the new value, the time, and the actor.
6.5. The Audit Trail SHALL be append-only: no API, command, or manual mechanism SHALL update or delete existing entries.
6.6. The Audit Trail SHALL be write-once: after an entry has been written it SHALL NOT be changed.
6.7. The audit trail entries SHALL have a hash chain with canonical JSON in the exact components described in the design doc, so an external reviewer can verify integrity.
6.8. WHEN a tampering attempt has changed the second entry THEN verifyChain SHALL return a broken state with a brokenAtSeq, and the UI SHALL visibly show BROKEN.
6.9. WHEN any auditor wants the audit trail THEN the system SHALL provide an interface with filters by outcome, reason code, and recipient.
6.10. The audit trail SHALL be seekable: it SHALL correctly paginate after a supplied sequence number.
6.11. The audit trail SHALL include the proposal, its decision, payment (if any), and the audit entries linked to it, in one response.
6.12. The audit records SHALL be stored in the same transaction as the Simulated Payment, so no payment can exist without an audit record of it.

### Requirement 7: Public demo
**User Story:** As a hackathon judge or visitor, I want to try FrankenGuard in my browser without an account, so that I can see the Agent being cross-examined and stopped in real time.
**Acceptance Criteria:**
7.1. The public demo SHALL be reachable as a URL, and no visitor SHALL need an account to use it.
7.2. The public demo SHALL be a public, bot-compatible demo that no visitor needs to sign up for before using it.
7.3. The public demo SHALL create a sandbox that is isolated per visitor and resettable.
7.4. Any set-cookie headers SHALL be HttpOnly and Secure (in production) and SameSite=Lax.
7.5. A sandbox that has been idle for 60 minutes SHALL expire.
7.6. A sandbox SHALL have an absolute maximum lifetime of four hours.
7.7. A visitor SHALL be able to reset a sandbox so that it will be as if they visited for the first time.
7.8. An expired sandbox SHALL be purged by a periodic job.
7.9. The public demo SHALL provide a fixed set of scripted scenario buttons (including a successful payment scenario, a per-transaction cap scenario, a daily cap scenario, an unknown recipient scenario, and a frozen scenario).
7.10. A scripted scenario SHALL create proposals with a visible decision, reasons, and audit entries.
7.11. A sandbox SHALL expose an Operator controls panel with caps, allowlist, and freeze controls.
7.12. For every Proposal, the public demo SHALL display the Decision, each rule's pass/fail status, and the reason codes.
7.13. A visitor SHALL be able to inspect the Audit Trail and verify it on the same page.
7.14. IF an LLM provider is available THEN a free-text request box SHALL send exactly one live LLM call; no other demo action SHALL create an LLM call.
7.15. The scripted and live agents SHALL NOT be able to bypass or modify any rule, and SHALL NOT be able to move money. Their output SHALL be treated as untrusted input.
7.16. The public demo SHALL include rate limits and abuse controls. (Limits are defined per route in the design doc.)
7.17. The demo SHALL have a per-sandbox limit of 500 proposals and 2,000 audit entries. Per-tenant hard limits SHALL be defined in the design doc.
7.18. The public demo SHALL sanitize output, and agent-supplied or visitor-supplied text SHALL NOT be able to inject HTML/JS.
7.19. The public demo SHALL demonstrate prompt injection: the Agent proposes a payment with a memo that tells it to ignore the rules; the Rule Engine SHALL ignore that memo and apply the rules as written.
7.20. The public demo SHALL be perceivable for accessibility: text contrast and non-color cues SHALL be used for all statuses (e.g. icon labels and text labels).
7.21. The public demo SHALL be usable in at least one browser (Chrome is the target). Other browsers MAY respond differently on layout.

## Out of Scope
- No real money movement, no payment processor integrations, no bank connections.
- No background asynchronous processing (no queue workers, no cron jobs other than a purge job).
- No administrative server beyond the public demo website itself (no CMS or admin panel).
- User accounts, multi-tenant organizations, and role-based access control beyond a single Operator per sandbox.
- Performance at scale (hundreds of concurrent users) done as part of this hackathon.

## Open Questions
1. **Daily Window**: Is the daily window from UTC midnight to UTC midnight, or is it a rolling 24-hour window based on each sandbox's creation time? **Resolved: use UTC day boundaries from UTC midnight.**
2. **Persistence**: Are sandbox states and ledgers ephemeral, or perennial? What is the retention window for audit evidence? **Resolved: use a single-writer SQLite DB with no scaling noted, retained for the demo.**
3. **Agent Provider**: Is the live Agent powered by an LLM provider, a local stub, or a scripted agent? **Resolved: that is determined by the environment configuration at runtime (live agent powered by an LLM provider when configured; the default is a scripted demo).**
4. **Testing**: Is correctness verified by unit tests and API contract tests, with an automated browser test suite? **Resolved: yes; unit and property tests for the rule engine, plus API contract tests and automated browser tests.**
